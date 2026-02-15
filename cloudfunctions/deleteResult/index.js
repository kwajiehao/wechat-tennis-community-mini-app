// ABOUTME: Deletes a match result and resets the match to its previous status.
// ABOUTME: Admin-only operation that also recalculates stats for all participants.

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
    const matchesRes = await db.collection('matches')
      .where({ status: 'completed', participants: _.in([playerId]) })
      .get();
    const matches = matchesRes.data || [];
    const matchIds = matches.map(m => m._id);

    const resultsRes = matchIds.length > 0
      ? await db.collection('results').where({ matchId: _.in(matchIds) }).get()
      : { data: [] };

    const wins = (resultsRes.data || []).filter(r => (r.winnerPlayers || []).includes(playerId)).length;
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

  const { matchId } = event;
  if (!matchId) {
    throw new Error('MISSING_FIELDS');
  }

  // Verify the match exists
  const matchRes = await db.collection('matches').doc(matchId).get().catch(() => null);
  if (!matchRes || !matchRes.data) {
    throw new Error('MATCH_NOT_FOUND');
  }
  const match = matchRes.data;

  // Block if event has computed leaderboard (locked)
  if (match.eventId) {
    const eventRes = await db.collection('events').doc(match.eventId).get().catch(() => null);
    if (eventRes && eventRes.data && eventRes.data.leaderboard && eventRes.data.leaderboard.computed) {
      throw new Error('EVENT_LOCKED');
    }
  }

  // Find and delete the result
  const resultsRes = await db.collection('results').where({ matchId }).get();
  const results = resultsRes.data || [];
  for (const result of results) {
    await db.collection('results').doc(result._id).remove();
  }

  // Reset match to pre-result state
  await db.collection('matches').doc(matchId).update({
    data: {
      status: match.status === 'completed' ? 'approved' : match.status,
      completedAt: null,
      score: null,
      winner: null
    }
  });

  // Recalculate stats for all participants
  const participants = match.participants || [].concat(match.teamA || [], match.teamB || []);
  await recalcStatsForPlayers(participants, settings ? settings.pointsConfig : { win: 3, loss: 1 });

  return { matchId };
};
