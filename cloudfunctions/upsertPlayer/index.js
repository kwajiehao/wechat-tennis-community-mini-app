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

const MIN_ELO = 100;
const MAX_ELO = 3000;

function ntrpToElo(ntrp) {
  const elo = 1500 + ((ntrp || 3.0) - 4.0) * 300;
  return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(elo)));
}

function eloToDisplay(elo) {
  const dltr = 1.0 + (elo - MIN_ELO) * 15.5 / (MAX_ELO - MIN_ELO);
  return Math.round(Math.max(1.0, Math.min(16.5, dltr)) * 100) / 100;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const {
    playerId,
    createNew,
    name,
    ntrp,
    isActive = true,
    notes = ''
  } = event;

  // Normalize gender to uppercase for consistent storage
  const gender = (event.gender || '').toUpperCase();
  const now = new Date().toISOString();

  // Admin creating a test player (no OPENID link)
  if (createNew) {
    await assertAdmin(OPENID);
    const initialElo = ntrpToElo(ntrp);
    const res = await db.collection('players').add({
      data: {
        wechatOpenId: null,
        isTestPlayer: true,
        name,
        gender,
        ntrp,
        dltrElo: initialElo,
        dltr: eloToDisplay(initialElo),
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
      const updateData = { name, gender, ntrp, isActive, notes, updatedAt: now };
      // Seed DLTR from NTRP if player has no match-derived rating yet
      if (existing.data.dltrElo == null) {
        const elo = ntrpToElo(ntrp);
        updateData.dltrElo = elo;
        updateData.dltr = eloToDisplay(elo);
      }
      await db.collection('players').doc(playerId).update({
        data: updateData
      });
      const updated = await db.collection('players').doc(playerId).get();
      return { player: updated.data };
    }
    throw new Error('PLAYER_NOT_FOUND');
  }

  // User self-registration: create or update their own profile
  const res = await db.collection('players').where({ wechatOpenId: OPENID }).get();
  if (res.data.length > 0) {
    const existingPlayer = res.data[0];
    const updateData = { name, gender, updatedAt: now };
    if (ntrp !== undefined) updateData.ntrp = ntrp;
    // Seed DLTR from NTRP if player has no match-derived rating yet
    if (existingPlayer.dltrElo == null && ntrp !== undefined) {
      const elo = ntrpToElo(ntrp);
      updateData.dltrElo = elo;
      updateData.dltr = eloToDisplay(elo);
    }
    await db.collection('players').doc(existingPlayer._id).update({
      data: updateData
    });
    const updated = await db.collection('players').doc(existingPlayer._id).get();
    return { player: updated.data };
  }

  const initialElo = ntrpToElo(ntrp);
  const createData = {
    wechatOpenId: OPENID,
    name,
    gender,
    dltrElo: initialElo,
    dltr: eloToDisplay(initialElo),
    isActive: true,
    notes: '',
    createdAt: now,
    updatedAt: now
  };
  if (ntrp !== undefined) createData.ntrp = ntrp;
  const created = await db.collection('players').add({
    data: createData
  });
  await db.collection('players').doc(created._id).update({ data: { playerId: created._id } });
  const player = await db.collection('players').doc(created._id).get();
  return { player: player.data };
};
