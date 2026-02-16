// ABOUTME: Cloud function to delete an event and all related data.
// ABOUTME: Admin-only operation that cascade-deletes signups, matches, results, and recalculates stats.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SETTINGS_ID = 'core';

async function getAll(queryFn) {
  const LIMIT = 100;
  let all = [];
  let offset = 0;
  while (true) {
    const res = await queryFn().skip(offset).limit(LIMIT).get();
    const batch = res.data || [];
    all = all.concat(batch);
    if (batch.length < LIMIT) break;
    offset += batch.length;
  }
  return all;
}

async function batchIn(collectionName, field, values) {
  if (values.length === 0) return [];
  const BATCH = 20;
  let all = [];
  for (let i = 0; i < values.length; i += BATCH) {
    const chunk = values.slice(i, i + BATCH);
    const batch = await getAll(() => db.collection(collectionName).where({ [field]: _.in(chunk) }));
    all = all.concat(batch);
  }
  return all;
}
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

async function assertAdmin(openid) {
  const settings = await ensureSettings(openid);
  if (!settings.adminOpenIds.includes(openid)) {
    throw new Error('PERMISSION_DENIED');
  }
  return settings;
}

async function recalcStatsForPlayers(playerIds, pointsConfig) {
  if (!playerIds || playerIds.length === 0) {
    return;
  }

  const winPoints = pointsConfig && pointsConfig.win !== undefined ? pointsConfig.win : 3;
  const lossPoints = pointsConfig && pointsConfig.loss !== undefined ? pointsConfig.loss : 1;

  for (const playerId of playerIds) {
    const matches = await getAll(() => db.collection('matches')
      .where({ status: 'completed', participants: _.in([playerId]) }));
    const matchIds = matches.map(m => m._id);

    const resultsData = await batchIn('results', 'matchId', matchIds);

    const wins = resultsData.filter(r => (r.winnerPlayers || []).includes(playerId)).length;
    const matchesPlayed = matches.length;
    const losses = Math.max(0, matchesPlayed - wins);

    const signupsCountRes = await db.collection('signups')
      .where({ playerId, status: 'signed' })
      .count();
    const signupsCount = signupsCountRes.total || 0;

    const attendance = signupsCount == 0 ? 0 : Number((matchesPlayed / signupsCount).toFixed(2));
    const winRate = matchesPlayed == 0 ? 0 : Number((wins / matchesPlayed).toFixed(2));
    const points = wins * winPoints + losses * lossPoints;

    await db.collection('stats').doc(playerId).set({
      data: {
        playerId,
        matchesPlayed,
        wins,
        losses,
        attendance,
        winRate,
        points,
        lastUpdated: new Date().toISOString()
      }
    });
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const settings = await assertAdmin(OPENID);

  const { eventId } = event;
  if (!eventId) {
    throw new Error('MISSING_FIELDS');
  }

  const eventRes = await db.collection('events').doc(eventId).get().catch(() => null);
  if (!eventRes || !eventRes.data) {
    throw new Error('EVENT_NOT_FOUND');
  }

  const eventDoc = eventRes.data;
  if (eventDoc.leaderboard && eventDoc.leaderboard.computed) {
    throw new Error('EVENT_LOCKED');
  }

  // Collect all matches for this event
  const matches = await getAll(() => db.collection('matches').where({ eventId }));
  const matchIds = matches.map(m => m._id);

  // Collect all participant player IDs for stats recalculation
  const affectedPlayerIds = new Set();
  for (const match of matches) {
    const participants = match.participants || [].concat(match.teamA || [], match.teamB || []);
    for (const pid of participants) {
      affectedPlayerIds.add(pid);
    }
  }

  // Delete all results for these matches
  if (matchIds.length > 0) {
    const results = await batchIn('results', 'matchId', matchIds);
    for (const result of results) {
      await db.collection('results').doc(result._id).remove();
    }
  }

  // Delete all matches
  for (const match of matches) {
    await db.collection('matches').doc(match._id).remove();
  }

  // Delete all signups
  const signups = await getAll(() => db.collection('signups').where({ eventId }));
  for (const signup of signups) {
    await db.collection('signups').doc(signup._id).remove();
  }

  // Delete the event
  await db.collection('events').doc(eventId).remove();

  // Recalculate stats for affected players
  await recalcStatsForPlayers(
    Array.from(affectedPlayerIds),
    settings ? settings.pointsConfig : { win: 3, loss: 1 }
  );

  return { deleted: true, eventId };
};
