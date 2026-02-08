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

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) {
    return [];
  }
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((key, idx) => {
      row[key] = values[idx];
    });
    rows.push(row);
  }
  return rows;
}

function coerceValue(key, value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (key === 'ntrp' || key === 'points' || key === 'winRate' || key === 'attendance') {
    const num = parseFloat(value);
    return Number.isNaN(num) ? value : num;
  }
  if (key === 'isActive') {
    return value === 'true' || value === true;
  }
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  }
  return value;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  const { collection, csv } = event;
  if (!collection || !csv) {
    throw new Error('MISSING_FIELDS');
  }

  const rows = parseCsv(csv);
  const results = [];
  for (const row of rows) {
    const data = {};
    Object.keys(row).forEach(key => {
      data[key] = coerceValue(key, row[key]);
    });

    if (data._id) {
      const id = data._id;
      delete data._id;
      await db.collection(collection).doc(id).set({ data });
      results.push({ id, status: 'updated' });
    } else {
      const res = await db.collection(collection).add({ data });
      results.push({ id: res._id, status: 'created' });
    }
  }

  return { count: results.length, results };
};
