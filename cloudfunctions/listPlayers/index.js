// ABOUTME: Lists all players in the system.
// ABOUTME: All authenticated users can view; non-admins get filtered fields (no wechatOpenId).

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
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

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { mine } = event;

  if (mine) {
    const res = await db.collection('players').where({ wechatOpenId: OPENID }).get();
    return { players: res.data || [] };
  }

  const settings = await ensureSettings(OPENID);
  const isAdmin = settings.adminOpenIds.includes(OPENID);

  const res = await db.collection('players').orderBy('name', 'asc').get();
  const players = res.data || [];

  if (isAdmin) {
    return { players };
  }

  // Non-admins get player list without sensitive fields
  return {
    players: players.map(p => ({
      _id: p._id,
      playerId: p.playerId,
      name: p.name,
      ntrp: p.ntrp,
      gender: p.gender,
      isTestPlayer: p.isTestPlayer,
      isActive: p.isActive
    }))
  };
};
