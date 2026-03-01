const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SETTINGS_ID = 'core';

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

async function batchIn(collectionName, field, values) {
  if (values.length === 0) return [];
  const BATCH = 20;
  let all = [];
  for (let i = 0; i < values.length; i += BATCH) {
    const chunk = values.slice(i, i + BATCH);
    const batch = await getAll(() => db.collection(collectionName).where({ [field]: _.in(chunk) }));
    all = all.concat(batch);
  }
  return all;
}
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

async function getPlayerByOpenId(openid) {
  const res = await db.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

async function buildNames(matches) {
  const playerIds = new Set();
  const eventIds = new Set();
  const matchIds = [];
  matches.forEach(match => {
    (match.teamA || []).forEach(id => playerIds.add(id));
    (match.teamB || []).forEach(id => playerIds.add(id));
    if (match.eventId) {
      eventIds.add(match.eventId);
    }
    matchIds.push(match._id);
  });

  const playersData = await batchIn('players', '_id', Array.from(playerIds));
  const eventsData = await batchIn('events', '_id', Array.from(eventIds));
  const resultsData = await batchIn('results', 'matchId', matchIds);

  const playerMap = new Map(playersData.map(p => [p._id, p]));
  const eventMap = new Map(eventsData.map(e => [e._id, e]));
  const resultMap = new Map(resultsData.map(r => [r.matchId, r]));

  return matches.map(match => {
    const teamANames = (match.teamA || []).map(id => (playerMap.get(id) || {}).name || 'Unknown').join(', ');
    const teamBNames = (match.teamB || []).map(id => (playerMap.get(id) || {}).name || 'Unknown').join(', ');
    const eventTitle = eventMap.get(match.eventId) ? eventMap.get(match.eventId).title : '';
    const result = resultMap.get(match._id);
    return {
      ...match,
      teamANames,
      teamBNames,
      eventTitle,
      score: result ? result.score : '',
      winner: result ? result.winner : ''
    };
  });
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { eventId, mine } = event;

  let matches = [];
  if (mine) {
    const player = await getPlayerByOpenId(OPENID);
    if (!player) {
      return { matches: [] };
    }
    matches = await getAll(() => db.collection('matches')
      .where({ participants: _.in([player._id]) }));
  } else if (eventId) {
    // Anyone can view matches for a specific event
    matches = await getAll(() => db.collection('matches')
      .where({ eventId }));
  } else {
    await assertAdmin(OPENID);
    matches = await getAll(() => db.collection('matches'));
  }

  const enriched = await buildNames(matches);

  // Sort by matchNumber when available (event-specific views)
  enriched.sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  return { matches: enriched };
};
