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

  return { resultId: resultRes._id };
};
