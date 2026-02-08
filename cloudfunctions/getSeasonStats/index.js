// ABOUTME: Retrieves season statistics by aggregating player points from completed events.
// ABOUTME: Combines event-based points with manual adjustments for season leaderboard.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
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

async function getPlayerByOpenId(openid) {
  const res = await db.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const settings = await getSettings();

  let seasonId = event.seasonId || (settings ? settings.activeSeasonId : null);
  if (!seasonId) {
    return { season: null, stats: null, statsList: [] };
  }

  const seasonRes = await db.collection('seasons').doc(seasonId).get().catch(() => null);
  const season = seasonRes && seasonRes.data ? seasonRes.data : null;

  if (event.all) {
    await assertAdmin(OPENID);

    const eventsRes = await db.collection('events')
      .where({ seasonId, status: 'completed' })
      .field({ playerPoints: true })
      .get();
    const completedEvents = eventsRes.data || [];

    const playerPoints = {};
    for (const evt of completedEvents) {
      const eventPoints = evt.playerPoints || {};
      for (const [playerId, points] of Object.entries(eventPoints)) {
        playerPoints[playerId] = (playerPoints[playerId] || 0) + points;
      }
    }

    const adjustmentsRes = await db.collection('season_point_adjustments')
      .where({ seasonId })
      .get();
    const adjustments = adjustmentsRes.data || [];

    const adjustmentsByPlayer = {};
    for (const adj of adjustments) {
      const pid = adj.playerId;
      adjustmentsByPlayer[pid] = (adjustmentsByPlayer[pid] || 0) + (Number(adj.deltaPoints) || 0);
    }

    const allPlayerIds = new Set([
      ...Object.keys(playerPoints),
      ...Object.keys(adjustmentsByPlayer)
    ]);

    const statsList = [];
    for (const playerId of allPlayerIds) {
      const eventPoints = playerPoints[playerId] || 0;
      const adjustmentPoints = adjustmentsByPlayer[playerId] || 0;
      statsList.push({
        playerId,
        points: eventPoints + adjustmentPoints,
        eventPoints,
        adjustmentPoints
      });
    }

    statsList.sort((a, b) => b.points - a.points);

    return { season, statsList };
  }

  let playerId = event.playerId || null;
  if (event.mine || !playerId) {
    const player = await getPlayerByOpenId(OPENID);
    if (!player) {
      return { season, stats: null };
    }
    playerId = player._id;
  } else {
    await assertAdmin(OPENID);
  }

  const eventsRes = await db.collection('events')
    .where({ seasonId, status: 'completed' })
    .field({ playerPoints: true })
    .get();
  const completedEvents = eventsRes.data || [];

  let eventPoints = 0;
  for (const evt of completedEvents) {
    const evtPoints = evt.playerPoints || {};
    eventPoints += (evtPoints[playerId] || 0);
  }

  const adjustmentsRes = await db.collection('season_point_adjustments')
    .where({ seasonId, playerId })
    .get();
  const adjustmentPoints = (adjustmentsRes.data || []).reduce(
    (sum, item) => sum + (Number(item.deltaPoints) || 0),
    0
  );

  const points = eventPoints + adjustmentPoints;

  return {
    season,
    stats: {
      seasonId,
      playerId,
      points,
      eventPoints,
      adjustmentPoints
    }
  };
};
