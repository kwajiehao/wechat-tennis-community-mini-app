// ABOUTME: Replays all match history to compute DLTR (Elo-based) ratings for all players.
// ABOUTME: Admin-only migration function. Run once after deploying the new rating system.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const SETTINGS_ID = 'core';
const DEFAULT_SETTINGS = {
  adminOpenIds: [],
  pointsConfig: { win: 3, loss: 1 },
  ntrpScaleConfig: {},
  activeSeasonId: null
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

// Elo rating constants
const K_PROVISIONAL = 64;
const K_ESTABLISHED = 32;
const PROVISIONAL_THRESHOLD = 20;
const MIN_ELO = 100;
const MAX_ELO = 3000;

function getKFactor(matchCount) {
  return matchCount < PROVISIONAL_THRESHOLD ? K_PROVISIONAL : K_ESTABLISHED;
}

function ntrpToElo(ntrp) {
  const elo = 1500 + ((ntrp || 3.0) - 4.0) * 300;
  return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(elo)));
}

function eloToDisplay(elo) {
  const dltr = 1.0 + (elo - MIN_ELO) * 15.5 / (MAX_ELO - MIN_ELO);
  return Math.round(Math.max(1.0, Math.min(16.5, dltr)) * 100) / 100;
}

function extractGamesFromSets(sets, isTeamA) {
  if (!sets || sets.length === 0) return { won: 0, lost: 0 };

  let won = 0, lost = 0;
  for (const set of sets) {
    const teamAGames = set.teamAGames || 0;
    const teamBGames = set.teamBGames || 0;
    if (isTeamA) {
      won += teamAGames;
      lost += teamBGames;
    } else {
      won += teamBGames;
      lost += teamAGames;
    }
  }
  return { won, lost };
}

function computeEloDelta(ratingA, ratingB, aWins, gamesWon, gamesLost, kFactor) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const actualA = aWins ? 1 : 0;

  const totalGames = gamesWon + gamesLost;
  let marginMultiplier = 1.0;
  if (totalGames > 0) {
    const winnerGamePct = Math.max(gamesWon, gamesLost) / totalGames;
    marginMultiplier = 1.0 + (winnerGamePct - 0.5) * 1.0;
    marginMultiplier = Math.max(1.0, Math.min(1.5, marginMultiplier));
  }

  return kFactor * marginMultiplier * (actualA - expectedA);
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  // Fetch all completed matches ordered chronologically
  const matches = await getAll(() =>
    db.collection('matches')
      .where({ status: 'completed' })
      .orderBy('completedAt', 'asc')
  );

  if (matches.length === 0) {
    return { success: true, message: 'No completed matches found', playersUpdated: 0 };
  }

  // Fetch all results
  const matchIds = matches.map(m => m._id);
  const results = await batchIn('results', 'matchId', matchIds);
  const resultMap = new Map(results.map(r => [r.matchId, r]));

  // Fetch all players
  const players = await getAll(() => db.collection('players'));

  // Seed initial ratings from NTRP
  const ratings = new Map();
  const matchCounts = new Map();
  for (const p of players) {
    ratings.set(p._id, ntrpToElo(p.ntrp));
    matchCounts.set(p._id, 0);
  }

  // Replay matches chronologically
  let matchesProcessed = 0;
  for (const match of matches) {
    const result = resultMap.get(match._id);
    if (!result) continue;

    const teamA = match.teamA || [];
    const teamB = match.teamB || [];
    if (teamA.length === 0 || teamB.length === 0) continue;

    // Ensure all participants have a rating (unknown players seed from default NTRP)
    for (const id of [...teamA, ...teamB]) {
      if (!ratings.has(id)) ratings.set(id, ntrpToElo(null));
      if (!matchCounts.has(id)) matchCounts.set(id, 0);
    }

    // Team ratings = average of members
    const ratingA = teamA.reduce((sum, id) => sum + ratings.get(id), 0) / teamA.length;
    const ratingB = teamB.reduce((sum, id) => sum + ratings.get(id), 0) / teamB.length;

    // Determine winner from team A's perspective
    const aWins = result.winner === 'A' || result.winner === 'teamA';

    // Extract game counts
    const games = extractGamesFromSets(result.sets, true);
    const gamesWon = aWins ? games.won : games.lost;
    const gamesLost = aWins ? games.lost : games.won;

    for (const id of teamA) {
      const k = getKFactor(matchCounts.get(id));
      const delta = computeEloDelta(ratingA, ratingB, aWins, gamesWon, gamesLost, k);
      ratings.set(id, Math.max(MIN_ELO, Math.min(MAX_ELO, ratings.get(id) + delta)));
      matchCounts.set(id, matchCounts.get(id) + 1);
    }
    for (const id of teamB) {
      const k = getKFactor(matchCounts.get(id));
      const delta = computeEloDelta(ratingA, ratingB, aWins, gamesWon, gamesLost, k);
      ratings.set(id, Math.max(MIN_ELO, Math.min(MAX_ELO, ratings.get(id) - delta)));
      matchCounts.set(id, matchCounts.get(id) + 1);
    }
    matchesProcessed++;
  }

  // Write final ratings to database
  const now = new Date().toISOString();
  let playersUpdated = 0;
  for (const [playerId, rating] of ratings) {
    const dltr = eloToDisplay(Math.round(rating));
    await db.collection('players').doc(playerId).update({
      data: { dltrElo: Math.round(rating), dltr, dltrUpdatedAt: now }
    });
    playersUpdated++;
  }

  return { success: true, matchesProcessed, playersUpdated };
};
