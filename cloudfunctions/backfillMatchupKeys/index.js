// ABOUTME: One-time migration to add matchupKey to existing match documents.
// ABOUTME: Admin-only. Safe to re-run — skips matches that already have a key.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SETTINGS_ID = 'core';
const DEFAULT_SETTINGS = {
  adminOpenIds: [],
  pointsConfig: { win: 3, loss: 1 },
  ntrpScaleConfig: {}
};

async function getAll(queryFn) {
  const LIMIT = 100;
  let all = [];
  let offset = 0;
  while (true) {
    const res = await queryFn().skip(offset).limit(LIMIT).get();
    const batch = res.data || [];
    all = all.concat(batch);
    if (batch.length < LIMIT) break;
    offset += batch.length;
  }
  return all;
}

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

function buildMatchupKey(teamA, teamB) {
  const sortedA = [...teamA].sort().join('+');
  const sortedB = [...teamB].sort().join('+');
  return [sortedA, sortedB].sort().join('-vs-');
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  const matches = await getAll(() =>
    db.collection('matches').where({ matchupKey: _.exists(false) })
  );

  console.log(`[backfillMatchupKeys] found ${matches.length} matches without matchupKey`);

  let updated = 0;
  let skipped = 0;
  for (const match of matches) {
    if (!match.teamA || !match.teamB || match.teamA.length === 0 || match.teamB.length === 0) {
      console.log(`[backfillMatchupKeys] skipping match ${match._id} — missing teams`);
      skipped++;
      continue;
    }
    const key = buildMatchupKey(match.teamA, match.teamB);
    await db.collection('matches').doc(match._id).update({
      data: { matchupKey: key }
    });
    updated++;
  }

  console.log(`[backfillMatchupKeys] done: ${updated} updated, ${skipped} skipped`);
  return { updated, skipped, total: matches.length };
};
