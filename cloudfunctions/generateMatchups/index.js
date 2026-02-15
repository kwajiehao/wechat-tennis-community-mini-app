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

function ntrpToUTR(ntrp) {
  return 1.0 + ((ntrp || 3.0) - 1.0) * 2.5;
}

function getUTR(player) {
  const ntrpBased = ntrpToUTR(player.ntrp);
  if (player.utr == null) return ntrpBased;
  return (ntrpBased + player.utr) / 2;
}

function classifyPlayers(players) {
  const males = players.filter(p => (p.gender || '').toUpperCase() === 'M')
    .sort((a, b) => getUTR(b) - getUTR(a));
  const females = players.filter(p => (p.gender || '').toUpperCase() === 'F')
    .sort((a, b) => getUTR(b) - getUTR(a));
  return { males, females };
}

function planMatchDistribution(maleCount, femaleCount) {
  const totalPlayers = maleCount + femaleCount;
  const targetMatchesPerPlayer = totalPlayers <= 6 ? 3 : 4;
  const totalPlayerSlots = totalPlayers * targetMatchesPerPlayer;
  const totalMatches = Math.floor(totalPlayerSlots / 4);

  let mensDoubles = 0, womensDoubles = 0, mixedDoubles = 0;

  if (femaleCount >= 4) {
    womensDoubles = Math.min(Math.floor(femaleCount / 2), Math.floor(totalMatches / 3));
  }
  if (maleCount >= 4) {
    mensDoubles = Math.min(Math.floor(maleCount / 2), Math.floor(totalMatches / 3));
  }

  const pairCount = Math.min(maleCount, femaleCount);
  if (pairCount >= 2) {
    mixedDoubles = Math.max(1, totalMatches - mensDoubles - womensDoubles);
  }

  return { mensDoubles, womensDoubles, mixedDoubles, targetMatchesPerPlayer };
}

function formBalancedTeam(pool, usedPartners, playerId) {
  const sorted = pool.slice().sort((a, b) => getUTR(b) - getUTR(a));
  const midpoint = Math.floor(sorted.length / 2);

  const playerPartners = usedPartners.get(playerId) || new Set();
  const playerStrength = getUTR(sorted.find(p => p._id === playerId) || { ntrp: 3.0 });
  const isStrong = sorted.findIndex(p => p._id === playerId) < midpoint;

  const searchPool = isStrong ? sorted.slice(midpoint) : sorted.slice(0, midpoint);

  for (const candidate of searchPool) {
    if (candidate._id !== playerId && !playerPartners.has(candidate._id)) {
      return candidate._id;
    }
  }

  for (const candidate of sorted) {
    if (candidate._id !== playerId && !playerPartners.has(candidate._id)) {
      return candidate._id;
    }
  }

  return null;
}

function generateConstrainedMatchups(players, matchPlan, allowedTypes) {
  const { males, females } = classifyPlayers(players);
  const { mensDoubles, womensDoubles, mixedDoubles } = matchPlan;

  const usedPartners = new Map();
  const matchCounts = new Map();
  const matches = [];

  players.forEach(p => {
    usedPartners.set(p._id, new Set());
    matchCounts.set(p._id, 0);
  });

  function recordPartnership(id1, id2) {
    usedPartners.get(id1).add(id2);
    usedPartners.get(id2).add(id1);
  }

  function incrementMatchCount(ids) {
    ids.forEach(id => matchCounts.set(id, matchCounts.get(id) + 1));
  }

  function getLowestMatchCountPlayers(pool, count) {
    return pool.slice()
      .sort((a, b) => matchCounts.get(a._id) - matchCounts.get(b._id))
      .slice(0, count);
  }

  if (allowedTypes.includes('mens_doubles') && males.length >= 4) {
    for (let i = 0; i < mensDoubles; i++) {
      const available = males.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      if (available.length < 4) break;

      const candidates = getLowestMatchCountPlayers(available, 4);
      const p1 = candidates[0];
      const p2Id = formBalancedTeam(candidates, usedPartners, p1._id);
      if (!p2Id) continue;

      const remaining = candidates.filter(p => p._id !== p1._id && p._id !== p2Id);
      if (remaining.length < 2) continue;

      const p3 = remaining[0];
      const p4Id = formBalancedTeam(remaining, usedPartners, p3._id);
      if (!p4Id) continue;

      matches.push({
        matchType: 'mens_doubles',
        teamA: [p1._id, p2Id],
        teamB: [p3._id, p4Id]
      });
      recordPartnership(p1._id, p2Id);
      recordPartnership(p3._id, p4Id);
      incrementMatchCount([p1._id, p2Id, p3._id, p4Id]);
    }
  }

  if (allowedTypes.includes('womens_doubles') && females.length >= 4) {
    for (let i = 0; i < womensDoubles; i++) {
      const available = females.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      if (available.length < 4) break;

      const candidates = getLowestMatchCountPlayers(available, 4);
      const p1 = candidates[0];
      const p2Id = formBalancedTeam(candidates, usedPartners, p1._id);
      if (!p2Id) continue;

      const remaining = candidates.filter(p => p._id !== p1._id && p._id !== p2Id);
      if (remaining.length < 2) continue;

      const p3 = remaining[0];
      const p4Id = formBalancedTeam(remaining, usedPartners, p3._id);
      if (!p4Id) continue;

      matches.push({
        matchType: 'womens_doubles',
        teamA: [p1._id, p2Id],
        teamB: [p3._id, p4Id]
      });
      recordPartnership(p1._id, p2Id);
      recordPartnership(p3._id, p4Id);
      incrementMatchCount([p1._id, p2Id, p3._id, p4Id]);
    }
  }

  if (allowedTypes.includes('mixed_doubles') && males.length >= 2 && females.length >= 2) {
    for (let i = 0; i < mixedDoubles; i++) {
      const availMales = males.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      const availFemales = females.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      if (availMales.length < 2 || availFemales.length < 2) break;

      const maleCandidates = getLowestMatchCountPlayers(availMales, 2);
      const femaleCandidates = getLowestMatchCountPlayers(availFemales, 2);

      const m1 = maleCandidates[0];
      const m2 = maleCandidates[1];
      const f1 = femaleCandidates[0];
      const f2 = femaleCandidates[1];

      const m1Partners = usedPartners.get(m1._id);
      const m2Partners = usedPartners.get(m2._id);

      let teamA, teamB;
      if (!m1Partners.has(f1._id) && !m2Partners.has(f2._id)) {
        teamA = [m1._id, f1._id];
        teamB = [m2._id, f2._id];
      } else if (!m1Partners.has(f2._id) && !m2Partners.has(f1._id)) {
        teamA = [m1._id, f2._id];
        teamB = [m2._id, f1._id];
      } else {
        continue;
      }

      matches.push({
        matchType: 'mixed_doubles',
        teamA,
        teamB
      });
      recordPartnership(teamA[0], teamA[1]);
      recordPartnership(teamB[0], teamB[1]);
      incrementMatchCount([...teamA, ...teamB]);
    }
  }

  return { matches, matchCounts };
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

  if (eventData.status === 'completed' || eventData.status === 'match_started') {
    throw new Error('CANNOT_REGENERATE');
  }

  let seasonId = eventData.seasonId;
  if (!seasonId) {
    seasonId = await ensureActiveSeason(OPENID, eventData.date);
    await db.collection('events').doc(eventId).update({
      data: { seasonId }
    });
  }

  // Remove all non-completed matches (allows regeneration)
  await db.collection('matches')
    .where({ eventId, status: _.neq('completed') })
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

  const activePlayers = roster.map(r => r.player);
  const { males, females } = classifyPlayers(activePlayers);
  const allMatchTypes = eventData.matchTypesAllowed || VALID_MATCH_TYPES;
  const doublesTypes = allMatchTypes.filter(t => t.includes('doubles'));
  const matchPlan = planMatchDistribution(males.length, females.length);

  const { matches, matchCounts } = generateConstrainedMatchups(activePlayers, matchPlan, doublesTypes);

  const now = new Date().toISOString();
  const matchesToCreate = matches.map(match => ({
    eventId,
    seasonId,
    matchType: match.matchType,
    teamA: match.teamA,
    teamB: match.teamB,
    participants: match.teamA.concat(match.teamB),
    status: 'approved',
    generatedAt: now,
    approvedBy: null
  }));

  const waitlist = activePlayers
    .filter(p => matchCounts.get(p._id) === 0)
    .map(p => p._id);

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
