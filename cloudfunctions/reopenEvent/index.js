// ABOUTME: Reopens a completed event by reverting status and clearing points.
// ABOUTME: Allows admins to make corrections to match results before re-completing.

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

  if (eventData.status !== 'completed') {
    throw new Error('EVENT_NOT_COMPLETED');
  }

  await db.collection('events').doc(eventId).update({
    data: {
      status: 'matchups_approved',
      playerPoints: db.command.remove,
      completedAt: db.command.remove
    }
  });

  return { eventId };
};
