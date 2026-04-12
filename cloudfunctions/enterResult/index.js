// ABOUTME: Records match results and updates player statistics.
// ABOUTME: Supports both matchmaking-generated matches and ad-hoc matches with set-by-set scores.

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

async function assertAdmin(openid) {
  const settings = await ensureSettings(openid);
  if (!settings.adminOpenIds.includes(openid)) {
    throw new Error('PERMISSION_DENIED');
  }
  return settings;
}

function buildMatchupKey(teamA, teamB) {
  const sortedA = [...teamA].sort().join('+');
  const sortedB = [...teamB].sort().join('+');
  return [sortedA, sortedB].sort().join('-vs-');
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
  // NTRP 4.0 → 1500 (center), ±300 per NTRP level
  const elo = 1500 + ((ntrp || 3.0) - 4.0) * 300;
  return Math.max(MIN_ELO, Math.min(MAX_ELO, Math.round(elo)));
}

function eloToDisplay(elo) {
  // Map internal Elo (100-3000) to display scale (1.0-16.5)
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

async function updatePlayerRatings(match, winnerSide, sets) {
  const teamA = match.teamA || [];
  const teamB = match.teamB || [];
  const allIds = [...teamA, ...teamB];

  const players = await batchIn('players', '_id', allIds);
  const playerMap = new Map(players.map(p => [p._id, p]));

  const getElo = (id) => {
    const p = playerMap.get(id);
    if (p && p.dltrElo != null) return p.dltrElo;
    return ntrpToElo(p ? p.ntrp : null);
  };

  // Count completed matches per player for provisional K-factor
  const matchCountMap = new Map();
  for (const id of allIds) {
    const countRes = await db.collection('matches')
      .where({ status: 'completed', participants: _.in([id]) })
      .count();
    matchCountMap.set(id, countRes.total || 0);
  }

  const ratingA = teamA.reduce((sum, id) => sum + getElo(id), 0) / teamA.length;
  const ratingB = teamB.reduce((sum, id) => sum + getElo(id), 0) / teamB.length;

  const aWins = winnerSide === 'A';
  const games = extractGamesFromSets(sets, true);
  const gamesWon = aWins ? games.won : games.lost;
  const gamesLost = aWins ? games.lost : games.won;

  const now = new Date().toISOString();
  for (const id of teamA) {
    const k = getKFactor(matchCountMap.get(id) || 0);
    const delta = computeEloDelta(ratingA, ratingB, aWins, gamesWon, gamesLost, k);
    const newElo = Math.max(MIN_ELO, Math.min(MAX_ELO, getElo(id) + delta));
    await db.collection('players').doc(id).update({
      data: { dltrElo: Math.round(newElo), dltr: eloToDisplay(newElo), dltrUpdatedAt: now }
    });
  }
  for (const id of teamB) {
    const k = getKFactor(matchCountMap.get(id) || 0);
    const delta = computeEloDelta(ratingA, ratingB, aWins, gamesWon, gamesLost, k);
    const newElo = Math.max(MIN_ELO, Math.min(MAX_ELO, getElo(id) - delta));
    await db.collection('players').doc(id).update({
      data: { dltrElo: Math.round(newElo), dltr: eloToDisplay(newElo), dltrUpdatedAt: now }
    });
  }
}

async function recalcStatsForPlayers(playerIds, pointsConfig) {
  if (!playerIds || playerIds.length === 0) {
    return;
  }

  const winPoints = pointsConfig && pointsConfig.win !== undefined ? pointsConfig.win : 3;
  const lossPoints = pointsConfig && pointsConfig.loss !== undefined ? pointsConfig.loss : 1;

  for (const playerId of playerIds) {
    const matches = await getAll(() => db.collection('matches')
      .where({ status: 'completed', participants: _.in([playerId]) }));
    const matchIds = matches.map(m => m._id);

    const resultsData = await batchIn('results', 'matchId', matchIds);

    const wins = resultsData.filter(r => (r.winnerPlayers || []).includes(playerId)).length;
    const matchesPlayed = matches.length;
    const losses = Math.max(0, matchesPlayed - wins);

    const signupsCountRes = await db.collection('signups')
      .where({ playerId, status: 'signed' })
      .count();
    const signupsCount = signupsCountRes.total || 0;

    const attendance = signupsCount == 0 ? 0 : Number((matchesPlayed / signupsCount).toFixed(2));
    const winRate = matchesPlayed == 0 ? 0 : Number((wins / matchesPlayed).toFixed(2));
    const points = wins * winPoints + losses * lossPoints;

    await db.collection('stats').doc(playerId).set({
      data: {
        playerId,
        matchesPlayed,
        wins,
        losses,
        attendance,
        winRate,
        points,
        lastUpdated: new Date().toISOString()
      }
    });
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const settings = await assertAdmin(OPENID);

  const { matchId, score, winner, sets, teamA, teamB, matchType, eventId } = event;

  if (!winner) {
    throw new Error('MISSING_FIELDS');
  }

  let match;
  let actualMatchId = matchId;

  if (matchId) {
    const matchRes = await db.collection('matches').doc(matchId).get();
    match = matchRes.data;
    if (!match) {
      throw new Error('MATCH_NOT_FOUND');
    }
  } else if (teamA && teamB && matchType) {
    const now = new Date().toISOString();
    const seasonId = settings ? settings.activeSeasonId : null;
    const matchRes = await db.collection('matches').add({
      data: {
        eventId: eventId || null,
        seasonId,
        matchType,
        teamA,
        teamB,
        participants: teamA.concat(teamB),
        matchupKey: buildMatchupKey(teamA, teamB),
        status: 'adhoc',
        generatedAt: now,
        approvedBy: null
      }
    });
    actualMatchId = matchRes._id;
    await db.collection('matches').doc(actualMatchId).update({
      data: { matchId: actualMatchId }
    });
    const newMatchRes = await db.collection('matches').doc(actualMatchId).get();
    match = newMatchRes.data;
  } else {
    throw new Error('MISSING_FIELDS');
  }

  let seasonId = match.seasonId || (settings ? settings.activeSeasonId : null);
  if (seasonId && !match.seasonId) {
    await db.collection('matches').doc(actualMatchId).update({
      data: { seasonId }
    });
  }

  const existingResultsRes = await db.collection('results')
    .where({ matchId: actualMatchId })
    .limit(1)
    .get();
  if ((existingResultsRes.data || []).length > 0 || match.status === 'completed') {
    throw new Error('RESULT_ALREADY_EXISTS');
  }

  const winnerSide = winner.toUpperCase() === 'B' ? 'B' : 'A';
  const winnerPlayers = winnerSide === 'A' ? match.teamA : match.teamB;

  const finalScore = sets && sets.length > 0
    ? sets.map(s => {
        const a = s.teamAGames || 0;
        const b = s.teamBGames || 0;
        if (a == 4 && b == 3 && s.tiebreak !== undefined && s.tiebreak !== '') {
          return `${a}-${b}(${s.tiebreak})`;
        }
        if (a == 3 && b == 4 && s.tiebreak !== undefined && s.tiebreak !== '') {
          return `(${s.tiebreak})${a}-${b}`;
        }
        return `${a}-${b}`;
      }).join(' ')
    : (score || '');

  const now = new Date().toISOString();
  const resultRes = await db.collection('results').add({
    data: {
      matchId: actualMatchId,
      seasonId: seasonId || null,
      score: finalScore,
      sets: sets || null,
      winner: winnerSide,
      winnerPlayers,
      enteredBy: OPENID,
      enteredAt: now
    }
  });

  await db.collection('results').doc(resultRes._id).update({ data: { resultId: resultRes._id } });

  await db.collection('matches').doc(actualMatchId).update({
    data: {
      status: 'completed',
      completedAt: now,
      score: finalScore,
      winner: winnerSide
    }
  });

  const participants = match.participants || [].concat(match.teamA || [], match.teamB || []);
  await recalcStatsForPlayers(participants, settings ? settings.pointsConfig : { win: 3, loss: 1 });

  // Update player DLTR ratings (Elo-based)
  await updatePlayerRatings(match, winnerSide, sets);

  // Update event status to match_started if this is the first result
  const matchEventId = match.eventId || eventId;
  if (matchEventId) {
    const eventRes = await db.collection('events').doc(matchEventId).get().catch(() => null);
    if (eventRes && eventRes.data && eventRes.data.status === 'in_progress') {
      await db.collection('events').doc(matchEventId).update({
        data: { status: 'match_started' }
      });
    }
  }

  return { resultId: resultRes._id };
};
