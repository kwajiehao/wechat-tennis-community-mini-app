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

  const playersRes = playerIds.size > 0
    ? await db.collection('players').where({ _id: _.in(Array.from(playerIds)) }).get()
    : { data: [] };
  const eventsRes = eventIds.size > 0
    ? await db.collection('events').where({ _id: _.in(Array.from(eventIds)) }).get()
    : { data: [] };
  const resultsRes = matchIds.length > 0
    ? await db.collection('results').where({ matchId: _.in(matchIds) }).get()
    : { data: [] };

  const playerMap = new Map(playersRes.data.map(p => [p._id, p]));
  const eventMap = new Map(eventsRes.data.map(e => [e._id, e]));
  const resultMap = new Map((resultsRes.data || []).map(r => [r.matchId, r]));

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
      score: match.score || (result ? result.score : ''),
      winner: match.winner || (result ? result.winner : '')
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
    const res = await db.collection('matches')
      .where({ participants: _.in([player._id]) })
      .get();
    matches = res.data || [];
  } else if (eventId) {
    await assertAdmin(OPENID);
    const res = await db.collection('matches')
      .where({ eventId })
      .get();
    matches = res.data || [];
  } else {
    await assertAdmin(OPENID);
    const res = await db.collection('matches').get();
    matches = res.data || [];
  }

  const enriched = await buildNames(matches);
  return { matches: enriched };
};
