// ABOUTME: Retrieves head-to-head match history for a specific team matchup.
// ABOUTME: Accepts team compositions and returns all past matches between them.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

function buildMatchupKey(teamA, teamB) {
  const sortedA = [...teamA].sort().join('+');
  const sortedB = [...teamB].sort().join('+');
  return [sortedA, sortedB].sort().join('-vs-');
}

exports.main = async (event, context) => {
  const { teamA, teamB } = event;

  if (!teamA || !teamB || teamA.length === 0 || teamB.length === 0) {
    throw new Error('MISSING_FIELDS');
  }

  const matchupKey = buildMatchupKey(teamA, teamB);

  const matches = await getAll(() =>
    db.collection('matches')
      .where({ matchupKey, status: 'completed' })
      .orderBy('completedAt', 'desc')
  );

  if (matches.length === 0) {
    return { matches: [], matchupKey };
  }

  // Enrich with player names, event info, and results
  const playerIds = new Set();
  const eventIds = new Set();
  const matchIds = [];
  matches.forEach(match => {
    (match.teamA || []).forEach(id => playerIds.add(id));
    (match.teamB || []).forEach(id => playerIds.add(id));
    if (match.eventId) eventIds.add(match.eventId);
    matchIds.push(match._id);
  });

  const playersData = await batchIn('players', '_id', Array.from(playerIds));
  const eventsData = await batchIn('events', '_id', Array.from(eventIds));
  const resultsData = await batchIn('results', 'matchId', matchIds);

  const playerMap = new Map(playersData.map(p => [p._id, p]));
  const eventMap = new Map(eventsData.map(e => [e._id, e]));
  const resultMap = new Map(resultsData.map(r => [r.matchId, r]));

  const enriched = matches.map(match => {
    const teamANames = (match.teamA || []).map(id => (playerMap.get(id) || {}).name || 'Unknown').join(', ');
    const teamBNames = (match.teamB || []).map(id => (playerMap.get(id) || {}).name || 'Unknown').join(', ');
    const event = eventMap.get(match.eventId);
    const result = resultMap.get(match._id);
    return {
      ...match,
      teamANames,
      teamBNames,
      eventTitle: event ? event.title : '',
      eventDate: event ? event.date : '',
      score: result ? result.score : '',
      sets: result ? result.sets : null,
      winner: result ? result.winner : ''
    };
  });

  return { matches: enriched, matchupKey };
};
