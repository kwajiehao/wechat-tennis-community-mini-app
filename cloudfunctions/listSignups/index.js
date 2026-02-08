// ABOUTME: Lists signups for events, optionally filtered by event or current user.
// ABOUTME: Supports includeNames flag to enrich signups with player names.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SETTINGS_ID = 'core';
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
}

async function getPlayerByOpenId(openid) {
  const res = await db.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { eventId, mine, includeNames } = event;

  if (mine) {
    const player = await getPlayerByOpenId(OPENID);
    if (!player) {
      return { signups: [] };
    }
    const query = eventId ? { playerId: player._id, eventId } : { playerId: player._id };
    const res = await db.collection('signups').where(query).get();
    return { signups: res.data || [] };
  }

  if (eventId && !mine) {
    const res = await db.collection('signups')
      .where({ eventId, status: 'signed' })
      .get();
    let signups = res.data || [];

    if (includeNames) {
      const playerIds = signups.map(s => s.playerId);
      if (playerIds.length > 0) {
        const playersRes = await db.collection('players')
          .where({ _id: _.in(playerIds) })
          .get();
        const playerMap = new Map((playersRes.data || []).map(p => [p._id, p]));
        signups = signups.map(s => ({
          ...s,
          playerName: (playerMap.get(s.playerId) || {}).name || 'Unknown',
          playerNtrp: (playerMap.get(s.playerId) || {}).ntrp || null
        }));
      }
    }
    return { signups };
  }

  await assertAdmin(OPENID);

  const query = eventId ? { eventId } : {};
  const res = await db.collection('signups').where(query).get();
  return { signups: res.data || [] };
};
