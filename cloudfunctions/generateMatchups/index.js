// ABOUTME: Generates match pairings for an event based on signups and match types.
// ABOUTME: Groups players by NTRP rating and pairs them for singles, doubles, or mixed matches.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SETTINGS_ID = 'core';
const DEFAULT_SETTINGS = {
  adminOpenIds: [],
  pointsConfig: { win: 3, loss: 1 },
  ntrpScaleConfig: {},
  activeSeasonId: null
};

const VALID_MATCH_TYPES = [
  'mens_singles',
  'womens_singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles'
];

async function getSettings() {
  const res = await db.collection('settings').doc(SETTINGS_ID).get().catch(() => null);
  return res && res.data ? res.data : null;
}

async function ensureSettings(openid) {
  const existing = await getSettings();
  if (!existing) {
    const data = { ...DEFAULT_SETTINGS, adminOpenIds: [openid] };
    await db.collection('settings').doc(SETTINGS_ID).set({ data });
    return data;
  }
  const { _id, ...existingWithoutId } = existing;
  const merged = { ...DEFAULT_SETTINGS, ...existingWithoutId };
  if ((!merged.adminOpenIds || merged.adminOpenIds.length === 0) && openid) {
    merged.adminOpenIds = [openid];
  }
  await db.collection('settings').doc(SETTINGS_ID).set({ data: merged });
  return merged;
}

async function ensureActiveSeason(openid, startDate) {
  const settings = await ensureSettings(openid);
  if (settings.activeSeasonId) {
    return settings.activeSeasonId;
  }
  const now = new Date().toISOString();
  const seasonRes = await db.collection('seasons').add({
    data: {
      name: 'Legacy Season',
      startDate: startDate || now.slice(0, 10),
      endDate: '',
      status: 'active',
      pointsConfig: null,
      createdAt: now,
      closedAt: ''
    }
  });
  await db.collection('seasons').doc(seasonRes._id).update({
    data: { seasonId: seasonRes._id }
  });
  await db.collection('settings').doc(SETTINGS_ID).update({
    data: { activeSeasonId: seasonRes._id }
  });
  return seasonRes._id;
}

async function assertAdmin(openid) {
  const settings = await ensureSettings(openid);
  if (!settings.adminOpenIds.includes(openid)) {
    throw new Error('PERMISSION_DENIED');
  }
}

function sortByNtrp(list) {
  return list.slice().sort((a, b) => (a.ntrp || 0) - (b.ntrp || 0));
}

function prefersType(signup, matchType) {
  if (!signup.preferredMatchTypes || signup.preferredMatchTypes.length === 0) {
    return true;
  }
  return signup.preferredMatchTypes.includes(matchType);
}

function makeSingles(candidates) {
  const sorted = sortByNtrp(candidates.map(c => c.player));
  const matches = [];
  const leftover = [];

  for (let i = 0; i < sorted.length; i += 2) {
    if (i + 1 >= sorted.length) {
      leftover.push(sorted[i]);
      break;
    }
    matches.push({
      teamA: [sorted[i]._id],
      teamB: [sorted[i + 1]._id]
    });
  }

  return { matches, leftover };
}

function makeDoubles(candidates) {
  const sorted = sortByNtrp(candidates.map(c => c.player));
  const teams = [];
  const leftoverPlayers = [];

  for (let i = 0; i < sorted.length; i += 2) {
    if (i + 1 >= sorted.length) {
      leftoverPlayers.push(sorted[i]);
      break;
    }
    const team = [sorted[i], sorted[i + 1]];
    const total = (sorted[i].ntrp || 0) + (sorted[i + 1].ntrp || 0);
    teams.push({ players: team, total });
  }

  teams.sort((a, b) => a.total - b.total);
  const matches = [];
  const leftoverTeams = [];

  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 >= teams.length) {
      leftoverTeams.push(...teams[i].players);
      break;
    }
    matches.push({
      teamA: teams[i].players.map(p => p._id),
      teamB: teams[i + 1].players.map(p => p._id)
    });
  }

  return { matches, leftover: leftoverPlayers.concat(leftoverTeams) };
}

function makeMixed(candidates) {
  const males = [];
  const females = [];
  candidates.forEach(c => {
    if ((c.player.gender || '').toUpperCase() === 'F') {
      females.push(c.player);
    } else {
      males.push(c.player);
    }
  });

  const sortedM = sortByNtrp(males);
  const sortedF = sortByNtrp(females);
  const teams = [];
  const leftover = [];

  const pairCount = Math.min(sortedM.length, sortedF.length);
  for (let i = 0; i < pairCount; i += 1) {
    const team = [sortedM[i], sortedF[i]];
    const total = (sortedM[i].ntrp || 0) + (sortedF[i].ntrp || 0);
    teams.push({ players: team, total });
  }

  if (sortedM.length > pairCount) {
    leftover.push(...sortedM.slice(pairCount));
  }
  if (sortedF.length > pairCount) {
    leftover.push(...sortedF.slice(pairCount));
  }

  teams.sort((a, b) => a.total - b.total);
  const matches = [];
  const leftoverTeams = [];

  for (let i = 0; i < teams.length; i += 2) {
    if (i + 1 >= teams.length) {
      leftoverTeams.push(...teams[i].players);
      break;
    }
    matches.push({
      teamA: teams[i].players.map(p => p._id),
      teamB: teams[i + 1].players.map(p => p._id)
    });
  }

  return { matches, leftover: leftover.concat(leftoverTeams) };
}


exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  const { eventId } = event;
  if (!eventId) {
    throw new Error('MISSING_EVENT_ID');
  }

  const eventRes = await db.collection('events').doc(eventId).get();
  const eventData = eventRes.data;
  if (!eventData) {
    throw new Error('EVENT_NOT_FOUND');
  }

  let seasonId = eventData.seasonId;
  if (!seasonId) {
    seasonId = await ensureActiveSeason(OPENID, eventData.date);
    await db.collection('events').doc(eventId).update({
      data: { seasonId }
    });
  }

  await db.collection('matches')
    .where({ eventId, status: _.in(['draft', 'needs_admin']) })
    .remove();

  const signupsRes = await db.collection('signups')
    .where({ eventId, status: 'signed' })
    .get();
  const signups = signupsRes.data || [];
  const playerIds = signups.map(s => s.playerId);

  if (playerIds.length === 0) {
    return { matches: [], waitlist: [] };
  }

  const playersRes = await db.collection('players')
    .where({ _id: _.in(playerIds) })
    .get();
  const players = playersRes.data || [];
  const playerMap = new Map(players.map(p => [p._id, p]));

  const roster = signups
    .map(s => ({
      player: playerMap.get(s.playerId),
      signup: s
    }))
    .filter(r => r.player && r.player.isActive !== false);

  const matchTypes = eventData.matchTypesAllowed || VALID_MATCH_TYPES;
  const used = new Set();
  const matchesToCreate = [];

  matchTypes.forEach(matchType => {
    let candidates = roster.filter(r => !used.has(r.player._id) && prefersType(r.signup, matchType));
    if (candidates.length === 0) {
      return;
    }

    let result;
    switch (matchType) {
      case 'mens_singles':
        candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'M');
        result = makeSingles(candidates);
        break;
      case 'womens_singles':
        candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'F');
        result = makeSingles(candidates);
        break;
      case 'mens_doubles':
        candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'M');
        result = makeDoubles(candidates);
        break;
      case 'womens_doubles':
        candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'F');
        result = makeDoubles(candidates);
        break;
      case 'mixed_doubles':
        result = makeMixed(candidates);
        break;
      default:
        return;
    }

    result.matches.forEach(match => {
      match.teamA.forEach(id => used.add(id));
      match.teamB.forEach(id => used.add(id));
      matchesToCreate.push({
        eventId,
        seasonId,
        matchType,
        teamA: match.teamA,
        teamB: match.teamB,
        participants: match.teamA.concat(match.teamB),
        status: 'approved',
        generatedAt: new Date().toISOString(),
        approvedBy: null
      });
    });
  });

  const waitlist = roster
    .map(r => r.player._id)
    .filter(id => !used.has(id));

  const createTasks = matchesToCreate.map(match => db.collection('matches').add({ data: match }));
  await Promise.all(createTasks);

  await db.collection('events').doc(eventId).update({
    data: {
      waitlist,
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    }
  });

  return { matchCount: matchesToCreate.length, waitlist };
};
