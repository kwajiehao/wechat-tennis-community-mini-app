// ABOUTME: Cloud function to delete a matchup from an event.
// ABOUTME: Admin-only operation that removes a match record.

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
  const { matchId } = event;

  if (!matchId) {
    throw new Error('MISSING_FIELDS');
  }

  await assertAdmin(OPENID);

  const matchRes = await db.collection('matches').doc(matchId).get().catch(() => null);
  if (!matchRes || !matchRes.data) {
    throw new Error('MATCH_NOT_FOUND');
  }

  const eventId = matchRes.data.eventId;
  if (eventId) {
    const eventRes = await db.collection('events').doc(eventId).get().catch(() => null);
    if (eventRes && eventRes.data && eventRes.data.status === 'completed') {
      throw new Error('EVENT_COMPLETED');
    }
  }

  await db.collection('matches').doc(matchId).remove();

  return { deleted: true };
};
