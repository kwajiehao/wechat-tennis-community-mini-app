// ABOUTME: Records match results and updates player statistics.
// ABOUTME: Supports both matchmaking-generated matches and ad-hoc matches with set-by-set scores.

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

function ntrpToUTR(ntrp) {
  // Convert NTRP (1.0-7.0) to UTR scale (1.0-16.5)
  // NTRP 2.5 ≈ UTR 2, NTRP 4.0 ≈ UTR 6, NTRP 5.5 ≈ UTR 10
  return 1.0 + ((ntrp || 3.0) - 1.0) * 2.5;
}

function getUTR(player) {
  if (player.utr != null) return player.utr;
  return ntrpToUTR(player.ntrp);
}

function calculateMatchRating(opponentUTR, gamesWon, gamesLost, didWin) {
  const totalGames = gamesWon + gamesLost;
  if (totalGames === 0) {
    // No game data, use simple win/loss adjustment
    return opponentUTR + (didWin ? 0.5 : -0.5);
  }

  const gamePercentage = gamesWon / totalGames;
  // Adjustment ranges from -1.5 (0% games) to +1.5 (100% games)
  // 50% games = 0 adjustment (you performed at opponent's level)
  const adjustment = (gamePercentage - 0.5) * 3.0;

  return opponentUTR + adjustment;
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

async function recalculatePlayerUTR(playerId) {
  // Fetch last 30 completed matches for this player
  const matchesRes = await db.collection('matches')
    .where({ status: 'completed', participants: _.in([playerId]) })
    .orderBy('completedAt', 'desc')
    .limit(30)
    .get();
  const matches = matchesRes.data || [];

  if (matches.length === 0) return null;

  const matchIds = matches.map(m => m._id);
  const resultsRes = await db.collection('results')
    .where({ matchId: _.in(matchIds) })
    .get();
  const resultMap = new Map((resultsRes.data || []).map(r => [r.matchId, r]));

  // Get all opponent player IDs
  const opponentIds = new Set();
  matches.forEach(m => {
    (m.teamA || []).forEach(id => { if (id !== playerId) opponentIds.add(id); });
    (m.teamB || []).forEach(id => { if (id !== playerId) opponentIds.add(id); });
  });

  const opponentsRes = await db.collection('players')
    .where({ _id: _.in([...opponentIds]) })
    .get();
  const opponentMap = new Map((opponentsRes.data || []).map(p => [p._id, p]));

  // Calculate weighted average of match ratings
  let weightedSum = 0;
  let totalWeight = 0;
  const now = Date.now();

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const result = resultMap.get(match._id);
    if (!result) continue;

    const isTeamA = (match.teamA || []).includes(playerId);
    const didWin = (result.winnerPlayers || []).includes(playerId);

    // Get opponent team UTR
    const opponentTeam = isTeamA ? match.teamB : match.teamA;
    let opponentUTR = 0;
    for (const oppId of opponentTeam) {
      const opp = opponentMap.get(oppId);
      opponentUTR += opp ? getUTR(opp) : 5.0; // Default 5.0 if unknown
    }
    opponentUTR = opponentUTR / opponentTeam.length;

    // Extract games from sets
    const games = extractGamesFromSets(result.sets, isTeamA);
    const matchRating = calculateMatchRating(opponentUTR, games.won, games.lost, didWin);

    // Recency weight: newer matches count more
    // Decay factor based on match age (days) and position
    const matchDate = new Date(match.completedAt || match.generatedAt).getTime();
    const daysAgo = (now - matchDate) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysAgo / 180); // Half-life of ~180 days
    const positionWeight = (matches.length - i) / matches.length;
    const weight = timeDecay * positionWeight;

    weightedSum += matchRating * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  // Clamp to valid UTR range
  const newUTR = Math.max(1.0, Math.min(16.5, weightedSum / totalWeight));
  return Math.round(newUTR * 100) / 100; // Round to 2 decimals
}

async function updatePlayerStrength(match, winnerSide, sets) {
  const allIds = [...(match.teamA || []), ...(match.teamB || [])];

  const playersRes = await db.collection('players')
    .where({ _id: _.in(allIds) })
    .get();
  const players = playersRes.data || [];

  const now = new Date().toISOString();

  // Initialize UTR for players without it (from NTRP)
  for (const player of players) {
    if (player.utr == null) {
      const initialUTR = ntrpToUTR(player.ntrp);
      await db.collection('players').doc(player._id).update({
        data: { utr: initialUTR, utrUpdatedAt: now }
      });
    }
  }

  // Recalculate UTR for all participants based on match history
  for (const playerId of allIds) {
    const newUTR = await recalculatePlayerUTR(playerId);
    if (newUTR !== null) {
      await db.collection('players').doc(playerId).update({
        data: { utr: newUTR, utrUpdatedAt: now }
      });
    }
  }
}

async function recalcStatsForPlayers(playerIds, pointsConfig) {
  if (!playerIds || playerIds.length === 0) {
    return;
  }

  const winPoints = pointsConfig && pointsConfig.win !== undefined ? pointsConfig.win : 3;
  const lossPoints = pointsConfig && pointsConfig.loss !== undefined ? pointsConfig.loss : 1;

  for (const playerId of playerIds) {
    const matchesRes = await db.collection('matches')
      .where({ status: 'completed', participants: _.in([playerId]) })
      .get();
    const matches = matchesRes.data || [];
    const matchIds = matches.map(m => m._id);

    const resultsRes = matchIds.length > 0
      ? await db.collection('results').where({ matchId: _.in(matchIds) }).get()
      : { data: [] };

    const wins = (resultsRes.data || []).filter(r => (r.winnerPlayers || []).includes(playerId)).length;
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

  const winnerSide = winner.toUpperCase() === 'B' ? 'B' : 'A';
  const winnerPlayers = winnerSide === 'A' ? match.teamA : match.teamB;

  const finalScore = sets && sets.length > 0
    ? sets.map(s => `${s.teamAGames || 0}-${s.teamBGames || 0}`).join(' ')
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

  // Update player UTR ratings
  await updatePlayerStrength(match, winnerSide, sets);

  return { resultId: resultRes._id };
};
