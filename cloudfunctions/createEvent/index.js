// ABOUTME: Creates a new tennis event with specified date, location, start/end times, and match types.
// ABOUTME: Requires admin permission. Associates event with active season if no season specified.

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

const VALID_MATCH_TYPES = [
  'singles',
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
  const { _id, ...existingWithoutId } = existing;
  const merged = { ...DEFAULT_SETTINGS, ...existingWithoutId };
  if ((!merged.adminOpenIds || merged.adminOpenIds.length === 0) && openid) {
    merged.adminOpenIds = [openid];
  }
  await db.collection('settings').doc(SETTINGS_ID).set({ data: merged });
  return merged;
}

async function ensureActiveSeason(openid, startDate) {
  const settings = await ensureSettings(openid);
  if (settings.activeSeasonId) {
    return settings.activeSeasonId;
  }
  const now = new Date().toISOString();
  const seasonRes = await db.collection('seasons').add({
    data: {
      name: 'Legacy Season',
      startDate: startDate || now.slice(0, 10),
      endDate: '',
      status: 'active',
      pointsConfig: null,
      createdAt: now,
      closedAt: ''
    }
  });
  await db.collection('seasons').doc(seasonRes._id).update({
    data: { seasonId: seasonRes._id }
  });
  await db.collection('settings').doc(SETTINGS_ID).update({
    data: { activeSeasonId: seasonRes._id }
  });
  return seasonRes._id;
}

async function assertAdmin(openid) {
  const settings = await ensureSettings(openid);
  if (!settings.adminOpenIds.includes(openid)) {
    throw new Error('PERMISSION_DENIED');
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  const VALID_EVENT_TYPES = ['singles', 'doubles'];
  const {
    title,
    date,
    location,
    startTime = '',
    endTime = '',
    eventType: rawEventType,
    matchTypesAllowed = VALID_MATCH_TYPES,
    seasonId: providedSeasonId
  } = event;

  const eventType = VALID_EVENT_TYPES.includes(rawEventType) ? rawEventType : 'doubles';

  if (!title || !date) {
    throw new Error('MISSING_FIELDS');
  }

  const existingRes = await db.collection('events')
    .where({ title })
    .count();
  if (existingRes.total > 0) {
    throw new Error('DUPLICATE_EVENT_TITLE');
  }

  const validatedMatchTypes = eventType === 'singles'
    ? ['singles']
    : matchTypesAllowed.filter(t => VALID_MATCH_TYPES.includes(t));
  if (validatedMatchTypes.length === 0) {
    throw new Error('INVALID_MATCH_TYPES');
  }

  const seasonId = providedSeasonId || await ensureActiveSeason(OPENID, date);
  const now = new Date().toISOString();
  const res = await db.collection('events').add({
    data: {
      title,
      date,
      location: location || '',
      startTime,
      endTime,
      eventType,
      matchTypesAllowed: validatedMatchTypes,
      status: 'open',
      waitlist: [],
      createdBy: OPENID,
      createdAt: now,
      updatedAt: now,
      seasonId
    }
  });

  await db.collection('events').doc(res._id).update({
    data: {
      eventId: res._id
    }
  });

  return { eventId: res._id };
};
