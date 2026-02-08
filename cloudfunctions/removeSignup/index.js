// ABOUTME: Admin function to remove a player's signup from an event.
// ABOUTME: Sets signup status to 'withdrawn' for the specified player and event.

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

async function isAdmin(openid) {
  const settings = await ensureSettings(openid);
  return settings.adminOpenIds.includes(openid);
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { eventId, playerId } = event;

  if (!eventId || !playerId) {
    throw new Error('MISSING_FIELDS');
  }

  const adminCheck = await isAdmin(OPENID);
  if (!adminCheck) {
    throw new Error('PERMISSION_DENIED');
  }

  const eventRes = await db.collection('events').doc(eventId).get().catch(() => null);
  const eventData = eventRes && eventRes.data ? eventRes.data : null;
  if (!eventData) {
    throw new Error('EVENT_NOT_FOUND');
  }

  if (eventData.status === 'completed') {
    throw new Error('EVENT_COMPLETED');
  }

  const existing = await db.collection('signups')
    .where({ eventId, playerId })
    .get();

  if (existing.data.length === 0) {
    throw new Error('NOT_SIGNED_UP');
  }

  const signupId = existing.data[0]._id;
  await db.collection('signups').doc(signupId).update({
    data: {
      status: 'withdrawn',
      updatedAt: new Date().toISOString()
    }
  });

  return { success: true };
};
