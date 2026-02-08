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

async function getPlayerByOpenId(openid) {
  const res = await db.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { eventId, playerId: targetPlayerId, availabilitySlots = [], preferredMatchTypes = [] } = event;

  if (!eventId) {
    throw new Error('MISSING_EVENT_ID');
  }

  let player;
  if (targetPlayerId) {
    const adminCheck = await isAdmin(OPENID);
    if (!adminCheck) {
      throw new Error('PERMISSION_DENIED');
    }
    const playerRes = await db.collection('players').doc(targetPlayerId).get().catch(() => null);
    player = playerRes && playerRes.data ? playerRes.data : null;
    if (!player) {
      throw new Error('PLAYER_NOT_FOUND');
    }
  } else {
    player = await getPlayerByOpenId(OPENID);
    if (!player) {
      throw new Error('MISSING_PROFILE');
    }
  }

  if (!player.name || !player.gender || player.ntrp === null || player.ntrp === undefined) {
    throw new Error('PROFILE_INCOMPLETE');
  }

  const eventRes = await db.collection('events').doc(eventId).get().catch(() => null);
  const eventData = eventRes && eventRes.data ? eventRes.data : null;
  if (!eventData) {
    throw new Error('EVENT_NOT_FOUND');
  }

  // Check signup limit (only for new signups, not updates)
  const existingCheck = await db.collection('signups')
    .where({ eventId, playerId: player._id })
    .get();
  if (existingCheck.data.length === 0) {
    const signupCount = await db.collection('signups')
      .where({ eventId, status: 'signed' })
      .count();
    const maxPlayers = eventData.maxPlayers || 9;
    if (signupCount.total >= maxPlayers) {
      throw new Error('EVENT_FULL');
    }
  }

  const settings = await getSettings();
  const seasonId = eventData.seasonId || (settings ? settings.activeSeasonId : null);

  const existing = await db.collection('signups')
    .where({ eventId, playerId: player._id })
    .get();

  const now = new Date().toISOString();
  if (existing.data.length > 0) {
    const signupId = existing.data[0]._id;
    await db.collection('signups').doc(signupId).update({
      data: {
        availabilitySlots,
        preferredMatchTypes,
        status: 'signed',
        updatedAt: now,
        seasonId
      }
    });
    return { signupId };
  }

  const res = await db.collection('signups').add({
    data: {
      eventId,
      playerId: player._id,
      availabilitySlots,
      preferredMatchTypes,
      status: 'signed',
      createdAt: now,
      seasonId
    }
  });

  await db.collection('signups').doc(res._id).update({
    data: { signupId: res._id }
  });

  return { signupId: res._id };
};
