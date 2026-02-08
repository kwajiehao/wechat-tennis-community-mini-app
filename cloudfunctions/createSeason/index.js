// ABOUTME: Creates a new season for the tennis league.
// ABOUTME: Deactivates any previously active season when the new season becomes active.

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
  const settings = await assertAdmin(OPENID);

  const now = new Date().toISOString();
  const name = event.name || `Season ${new Date().getFullYear()}`;
  const startDate = event.startDate || now.slice(0, 10);
  const endDate = event.endDate || '';
  const shouldBeActive = event.setActive === true || event.setActive === 'true';

  const seasonRes = await db.collection('seasons').add({
    data: {
      name,
      startDate,
      endDate,
      status: shouldBeActive ? 'active' : 'inactive',
      createdAt: now,
      closedAt: ''
    }
  });

  await db.collection('seasons').doc(seasonRes._id).update({
    data: { seasonId: seasonRes._id }
  });

  if (shouldBeActive) {
    if (settings.activeSeasonId) {
      await db.collection('seasons').doc(settings.activeSeasonId).update({
        data: { status: 'inactive' }
      });
    }
    await db.collection('settings').doc(SETTINGS_ID).update({
      data: { activeSeasonId: seasonRes._id }
    });
  }

  return { seasonId: seasonRes._id };
};
