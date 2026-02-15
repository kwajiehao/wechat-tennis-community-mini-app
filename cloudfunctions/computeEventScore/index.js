// ABOUTME: Computes final leaderboard for a completed event with ranking bonuses.
// ABOUTME: Handles tie-breaking and locks event scores until admin reopens.

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

// Leaderboard calculation rules:
// 1. Count wins per player (doubles matches count as 1 win for each player on winning team)
// 2. Calculate game difference: sum of (gamesWon - gamesLost) across all matches
// 3. Sort by: wins DESC, then game difference DESC
// 4. If tied on both wins AND game difference, admin must pick champion
// 5. Bonuses: 1st place gets +4 points, 2nd place gets +2 points
// 6. Total points = wins + bonus

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  await assertAdmin(OPENID);

  const { eventId, championId } = event;
  if (!eventId) {
    throw new Error('MISSING_EVENT_ID');
  }

  const eventRes = await db.collection('events').doc(eventId).get();
  const eventData = eventRes.data;
  if (!eventData) {
    throw new Error('EVENT_NOT_FOUND');
  }

  if (eventData.status !== 'completed') {
    throw new Error('EVENT_NOT_COMPLETED');
  }

  if (eventData.leaderboard && eventData.leaderboard.computed) {
    throw new Error('SCORE_ALREADY_COMPUTED');
  }

  // Fetch all completed matches for this event
  const matchesRes = await db.collection('matches')
    .where({ eventId, status: 'completed' })
    .get();
  const matches = matchesRes.data || [];

  // Fetch results for those matches
  const matchIds = matches.map(m => m._id);
  const resultsRes = matchIds.length > 0
    ? await db.collection('results').where({ matchId: _.in(matchIds) }).get()
    : { data: [] };
  const results = resultsRes.data || [];
  const resultMap = new Map(results.map(r => [r.matchId, r]));

  // Calculate player stats: wins and game difference
  const playerStats = {};
  for (const match of matches) {
    const result = resultMap.get(match._id);
    if (!result) continue;

    const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];

    // Initialize players if not seen
    for (const pid of allPlayers) {
      if (!playerStats[pid]) {
        playerStats[pid] = { wins: 0, gamesWon: 0, gamesLost: 0 };
      }
    }

    // Count wins (1 per winning player per match)
    const winnerPlayers = result.winnerPlayers || [];
    for (const pid of winnerPlayers) {
      playerStats[pid].wins += 1;
    }

    // Calculate games from sets for game difference
    const sets = result.sets || [];
    for (const set of sets) {
      const teamAGames = parseInt(set.teamAGames) || 0;
      const teamBGames = parseInt(set.teamBGames) || 0;

      for (const pid of (match.teamA || [])) {
        playerStats[pid].gamesWon += teamAGames;
        playerStats[pid].gamesLost += teamBGames;
      }
      for (const pid of (match.teamB || [])) {
        playerStats[pid].gamesWon += teamBGames;
        playerStats[pid].gamesLost += teamAGames;
      }
    }
  }

  // Build rankings array
  const rankings = Object.entries(playerStats).map(([playerId, stats]) => ({
    playerId,
    wins: stats.wins,
    gameDifference: stats.gamesWon - stats.gamesLost,
    bonus: 0,
    totalPoints: stats.wins,
    rank: 0,
    remarks: null
  }));

  // Sort by wins DESC, then game difference DESC
  rankings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.gameDifference - a.gameDifference;
  });

  // Check for ties at top positions
  const hasTieForFirst = rankings.length >= 2 &&
    rankings[0].wins === rankings[1].wins &&
    rankings[0].gameDifference === rankings[1].gameDifference;

  // If tie exists and no champion selected, return tie info for admin to resolve
  if (hasTieForFirst && !championId) {
    const tiedPlayers = rankings.filter(r =>
      r.wins === rankings[0].wins &&
      r.gameDifference === rankings[0].gameDifference
    );

    // Fetch player names for tied players
    const tiedIds = tiedPlayers.map(p => p.playerId);
    const playersRes = await db.collection('players')
      .where({ _id: _.in(tiedIds) })
      .get();
    const playerNameMap = new Map((playersRes.data || []).map(p => [p._id, p.name]));

    for (const r of tiedPlayers) {
      r.playerName = playerNameMap.get(r.playerId) || 'Unknown';
    }

    return {
      requiresTieBreak: true,
      tiedPlayerIds: tiedIds,
      rankings: tiedPlayers
    };
  }

  // Apply tie-break if champion was selected
  let tieResolution = null;
  if (hasTieForFirst && championId) {
    const tiedIds = rankings.filter(r =>
      r.wins === rankings[0].wins &&
      r.gameDifference === rankings[0].gameDifference
    ).map(p => p.playerId);

    if (!tiedIds.includes(championId)) {
      throw new Error('INVALID_CHAMPION');
    }

    // Move champion to index 0
    const championIndex = rankings.findIndex(r => r.playerId === championId);
    const [champion] = rankings.splice(championIndex, 1);
    rankings.unshift(champion);

    tieResolution = {
      tiedPlayerIds: tiedIds,
      championId
    };
  }

  // Assign ranks and bonuses
  for (let i = 0; i < rankings.length; i++) {
    rankings[i].rank = i + 1;
    if (i === 0) {
      rankings[i].bonus = 4;
      rankings[i].remarks = '1st';
    } else if (i === 1) {
      rankings[i].bonus = 2;
      rankings[i].remarks = '2nd';
    }
    rankings[i].totalPoints = rankings[i].wins + rankings[i].bonus;
  }

  // Fetch player names for all rankings
  const playerIds = rankings.map(r => r.playerId);
  const playersRes = playerIds.length > 0
    ? await db.collection('players').where({ _id: _.in(playerIds) }).get()
    : { data: [] };
  const playerNameMap = new Map((playersRes.data || []).map(p => [p._id, p.name]));

  for (const r of rankings) {
    r.playerName = playerNameMap.get(r.playerId) || 'Unknown';
  }

  // Compute playerPoints for season aggregation (totalPoints per player)
  const playerPoints = {};
  for (const r of rankings) {
    playerPoints[r.playerId] = r.totalPoints;
  }

  // Build leaderboard object
  const leaderboard = {
    computed: true,
    computedAt: new Date().toISOString(),
    computedBy: OPENID,
    rankings,
    hasTiesAtTop: hasTieForFirst
  };
  if (tieResolution) {
    leaderboard.tieResolution = tieResolution;
  }

  // Update event with leaderboard and playerPoints
  await db.collection('events').doc(eventId).update({
    data: {
      leaderboard: _.set(leaderboard),
      playerPoints: _.set(playerPoints)
    }
  });

  return { eventId, leaderboard };
};
