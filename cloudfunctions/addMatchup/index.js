// ABOUTME: Cloud function to add a matchup to an event.
// ABOUTME: Admin-only operation that creates a new match record.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const SETTINGS_ID = 'core';
const DEFAULT_SETTINGS = {
  adminOpenIds: [],
  pointsConfig: { win: 3, loss: 1 },
  ntrpScaleConfig: {}
};

const VALID_MATCH_TYPES = [
  'mens_singles',
  'womens_singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles'
];

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
  const { eventId, matchType, teamA, teamB } = event;

  if (!eventId || !matchType || !teamA || !teamB) {
    throw new Error('MISSING_FIELDS');
  }
  if (!VALID_MATCH_TYPES.includes(matchType)) {
    throw new Error('INVALID_MATCH_TYPE');
  }

  await assertAdmin(OPENID);

  const eventRes = await db.collection('events').doc(eventId).get().catch(() => null);
  if (!eventRes || !eventRes.data) {
    throw new Error('EVENT_NOT_FOUND');
  }
  if (eventRes.data.status === 'completed') {
    throw new Error('EVENT_COMPLETED');
  }

  const settings = await getSettings();
  const now = new Date().toISOString();
  const res = await db.collection('matches').add({
    data: {
      eventId,
      matchType,
      teamA,
      teamB,
      status: 'approved',
      seasonId: eventRes.data.seasonId || (settings ? settings.activeSeasonId : null),
      createdAt: now,
      updatedAt: now
    }
  });
  await db.collection('matches').doc(res._id).update({
    data: { matchId: res._id }
  });

  return { matchId: res._id };
};
