// ABOUTME: Generates match pairings for an event based on signups and match types.
// ABOUTME: Cloud function entry point — delegates to matchupEngine for pure algorithm logic.

const cloud = require('wx-server-sdk');
const {
  VALID_MATCH_TYPES,
  classifyPlayers,
  planMatchDistribution,
  generateConstrainedMatchups,
  generateSinglesMatchups,
  scheduleMatches
} = require('./matchupEngine');

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
  const eventType = eventData.eventType || 'doubles';

  let matches, matchCounts;
  if (eventType === 'singles') {
    ({ matches, matchCounts } = generateSinglesMatchups(activePlayers));
  } else {
    const { males, females } = classifyPlayers(activePlayers);
    const allMatchTypes = eventData.matchTypesAllowed || VALID_MATCH_TYPES;
    const doublesTypes = allMatchTypes.filter(t => t.includes('doubles'));
    const matchPlan = planMatchDistribution(males.length, females.length);
    ({ matches, matchCounts } = generateConstrainedMatchups(activePlayers, matchPlan, doublesTypes));
  }

  // Add participants field and schedule for balanced play order
  const withParticipants = matches.map(match => ({
    ...match,
    participants: match.teamA.concat(match.teamB)
  }));
  const scheduled = scheduleMatches(withParticipants);

  const now = new Date().toISOString();
  const matchesToCreate = scheduled.map(match => ({
    eventId,
    seasonId,
    matchType: match.matchType,
    matchNumber: match.matchNumber,
    teamA: match.teamA,
    teamB: match.teamB,
    participants: match.participants,
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
