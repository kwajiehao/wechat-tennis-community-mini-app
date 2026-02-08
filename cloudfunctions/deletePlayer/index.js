// ABOUTME: Cloud function to delete a player from the system.
// ABOUTME: Admin-only operation that removes the player record.

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
  const { playerId } = event;

  if (!playerId) {
    throw new Error('MISSING_PLAYER_ID');
  }

  await assertAdmin(OPENID);

  const existing = await db.collection('players').doc(playerId).get().catch(() => null);
  if (!existing || !existing.data) {
    throw new Error('PLAYER_NOT_FOUND');
  }

  await db.collection('players').doc(playerId).remove();

  return { deleted: true, playerId };
};
