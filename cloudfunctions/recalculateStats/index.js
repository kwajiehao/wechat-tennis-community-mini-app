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
  ntrpScaleConfig: {}
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
  if (!existing.adminOpenIds || existing.adminOpenIds.length === 0) {
    const updated = { ...DEFAULT_SETTINGS, ...existing, adminOpenIds: [openid] };
    await db.collection('settings').doc(SETTINGS_ID).set({ data: updated });
    return updated;
  }
  return existing;
}

async function assertAdmin(openid) {
  const settings = await ensureSettings(openid);
  if (!settings.adminOpenIds.includes(openid)) {
    throw new Error('PERMISSION_DENIED');
  }
  return settings;
}

async function recalcForPlayer(playerId, pointsConfig) {
  const winPoints = pointsConfig?.win ?? 3;
  const lossPoints = pointsConfig?.loss ?? 1;

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

  const attendance = signupsCount === 0 ? 0 : Number((matchesPlayed / signupsCount).toFixed(2));
  const winRate = matchesPlayed === 0 ? 0 : Number((wins / matchesPlayed).toFixed(2));
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

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const settings = await assertAdmin(OPENID);

  let playerIds = event.playerIds || [];
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    const playersData = await getAll(() => db.collection('players'));
    playerIds = playersData.map(p => p._id);
  }

  for (const playerId of playerIds) {
    await recalcForPlayer(playerId, settings ? settings.pointsConfig : { win: 3, loss: 1 });
  }

  return { count: playerIds.length };
};
