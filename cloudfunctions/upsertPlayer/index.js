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
  const {
    playerId,
    createNew,
    name,
    gender,
    ntrp,
    isActive = true,
    notes = ''
  } = event;

  const now = new Date().toISOString();

  // Admin creating a new player (no OPENID link)
  if (createNew) {
    await assertAdmin(OPENID);
    const res = await db.collection('players').add({
      data: {
        wechatOpenId: null,
        name,
        gender,
        ntrp,
        isActive,
        notes,
        createdAt: now,
        updatedAt: now
      }
    });
    await db.collection('players').doc(res._id).update({ data: { playerId: res._id } });
    const player = await db.collection('players').doc(res._id).get();
    return { player: player.data };
  }

  // Admin updating an existing player by ID
  if (playerId) {
    await assertAdmin(OPENID);
    const existing = await db.collection('players').doc(playerId).get().catch(() => null);
    if (existing && existing.data) {
      await db.collection('players').doc(playerId).update({
        data: {
          name,
          gender,
          ntrp,
          isActive,
          notes,
          updatedAt: now
        }
      });
      const updated = await db.collection('players').doc(playerId).get();
      return { player: updated.data };
    }
    throw new Error('PLAYER_NOT_FOUND');
  }

  // User self-registration: create or update their own profile
  const res = await db.collection('players').where({ wechatOpenId: OPENID }).get();
  if (res.data.length > 0) {
    const existingId = res.data[0]._id;
    await db.collection('players').doc(existingId).update({
      data: {
        name,
        gender,
        ntrp,
        updatedAt: now
      }
    });
    const updated = await db.collection('players').doc(existingId).get();
    return { player: updated.data };
  }

  const created = await db.collection('players').add({
    data: {
      wechatOpenId: OPENID,
      name,
      gender,
      ntrp,
      isActive: true,
      notes: '',
      createdAt: now,
      updatedAt: now
    }
  });
  await db.collection('players').doc(created._id).update({ data: { playerId: created._id } });
  const player = await db.collection('players').doc(created._id).get();
  return { player: player.data };
};
