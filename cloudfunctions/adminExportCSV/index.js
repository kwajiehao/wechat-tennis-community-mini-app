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

function toCsv(docs) {
  if (!docs || docs.length === 0) {
    return '';
  }
  const keys = new Set();
  docs.forEach(doc => {
    Object.keys(doc).forEach(k => keys.add(k));
  });
  const allKeys = Array.from(keys).filter(k => k !== '_id');
  allKeys.sort();
  const headers = ['_id'].concat(allKeys);

  const lines = [headers.join(',')];
  docs.forEach(doc => {
    const row = headers.map(key => {
      const value = doc[key];
      if (value === undefined || value === null) {
        return '';
      }
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      const raw = String(value);
      if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    });
    lines.push(row.join(','));
  });
  return lines.join('\n');
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  const { collection, eventId } = event;
  if (!collection) {
    throw new Error('MISSING_COLLECTION');
  }

  let query = db.collection(collection);
  if (eventId) {
    query = query.where({ eventId });
  }

  const res = await query.get();
  const csv = toCsv(res.data || []);
  return { csv, count: res.data ? res.data.length : 0 };
};
