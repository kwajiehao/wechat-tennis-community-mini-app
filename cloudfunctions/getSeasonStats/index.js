// ABOUTME: Retrieves season statistics by aggregating player points from completed events.
// ABOUTME: Combines event-based points with manual adjustments for season leaderboard.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
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
    const batch = await getAll(() => db.collection(collectionName).where({ [field]: db.command.in(chunk) }));
    all = all.concat(batch);
  }
  return all;
}

async function getSettings() {
  const res = await db.collection('settings').doc(SETTINGS_ID).get().catch(() => null);
  return res && res.data ? res.data : null;
}

async function getPlayerByOpenId(openid) {
  const res = await db.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const settings = await getSettings();

  let seasonId = event.seasonId || (settings ? settings.activeSeasonId : null);
  if (!seasonId) {
    return { season: null, stats: null, statsList: [] };
  }

  const seasonRes = await db.collection('seasons').doc(seasonId).get().catch(() => null);
  const season = seasonRes && seasonRes.data ? seasonRes.data : null;

  if (event.all) {
    // Fetch all active players to include everyone in leaderboard (even with 0 points)
    const allPlayers = await getAll(() => db.collection('players')
      .where({ isActive: db.command.neq(false) })
      .field({ _id: true, name: true }));

    const completedEvents = await getAll(() => db.collection('events')
      .where({ seasonId, status: 'completed' })
      .field({ playerPoints: true, leaderboard: true }));

    const playerPoints = {};
    const championCounts = {};
    for (const evt of completedEvents) {
      const eventPoints = evt.playerPoints || {};
      for (const [playerId, points] of Object.entries(eventPoints)) {
        playerPoints[playerId] = (playerPoints[playerId] || 0) + points;
      }
      if (evt.leaderboard && evt.leaderboard.computed) {
        const rankings = evt.leaderboard.rankings || [];
        const champion = rankings.find(r => r.rank === 1);
        if (champion) {
          championCounts[champion.playerId] = (championCounts[champion.playerId] || 0) + 1;
        }
      }
    }

    const adjustments = await getAll(() => db.collection('season_point_adjustments')
      .where({ seasonId }));

    const adjustmentsByPlayer = {};
    for (const adj of adjustments) {
      const pid = adj.playerId;
      adjustmentsByPlayer[pid] = (adjustmentsByPlayer[pid] || 0) + (Number(adj.deltaPoints) || 0);
    }

    // Compute wins/losses from completed matches in this season
    const completedMatches = await getAll(() => db.collection('matches')
      .where({ seasonId, status: 'completed' }));
    const matchIds = completedMatches.map(m => m._id);

    console.log('[getSeasonStats] seasonId:', seasonId, 'completedMatches:', completedMatches.length, 'matchIds:', matchIds.length);

    const results = await batchIn('results', 'matchId', matchIds);

    console.log('[getSeasonStats] results:', results.length);

    // Build wins/losses/matchesPlayed per player
    const playerWins = {};
    const playerMatchesPlayed = {};
    for (const match of completedMatches) {
      const players = [...(match.teamA || []), ...(match.teamB || [])];
      for (const pid of players) {
        playerMatchesPlayed[pid] = (playerMatchesPlayed[pid] || 0) + 1;
      }
    }

    console.log('[getSeasonStats] playerMatchesPlayed sample:', JSON.stringify(Object.entries(playerMatchesPlayed).slice(0, 5)));
    for (const result of results) {
      const winners = result.winnerPlayers || [];
      for (const pid of winners) {
        playerWins[pid] = (playerWins[pid] || 0) + 1;
      }
    }

    // Include all active players, not just those with points
    const statsList = allPlayers.map(player => {
      const playerId = player._id;
      const eventPts = playerPoints[playerId] || 0;
      const adjustmentPts = adjustmentsByPlayer[playerId] || 0;
      const wins = playerWins[playerId] || 0;
      const matchesPlayed = playerMatchesPlayed[playerId] || 0;
      const losses = matchesPlayed - wins;
      return {
        playerId,
        playerName: player.name,
        points: eventPts + adjustmentPts,
        eventPoints: eventPts,
        adjustmentPoints: adjustmentPts,
        wins,
        losses,
        matchesPlayed,
        championCount: championCounts[playerId] || 0
      };
    });

    // Sort by points descending, then by win percentage descending, then by name
    statsList.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aWinRate = a.matchesPlayed > 0 ? a.wins / a.matchesPlayed : 0;
      const bWinRate = b.matchesPlayed > 0 ? b.wins / b.matchesPlayed : 0;
      if (bWinRate !== aWinRate) return bWinRate - aWinRate;
      return (a.playerName || '').localeCompare(b.playerName || '');
    });

    return { season, statsList };
  }

  let playerId = event.playerId || null;
  if (event.mine || !playerId) {
    const player = await getPlayerByOpenId(OPENID);
    if (!player) {
      return { season, stats: null };
    }
    playerId = player._id;
  }

  const completedEvents = await getAll(() => db.collection('events')
    .where({ seasonId, status: 'completed' })
    .field({ _id: true, title: true, date: true, playerPoints: true, leaderboard: true }));

  // Build event breakdown: list of events with points earned from each
  const eventBreakdown = [];
  let totalEventPoints = 0;
  for (const evt of completedEvents) {
    const evtPoints = evt.playerPoints || {};
    const pts = evtPoints[playerId] || 0;
    if (pts > 0) {
      // Find player's placement in the leaderboard
      let placement = null;
      if (evt.leaderboard && evt.leaderboard.rankings) {
        const playerRanking = evt.leaderboard.rankings.find(r => r.playerId === playerId);
        if (playerRanking && playerRanking.rank <= 2) {
          placement = playerRanking.rank;
        }
      }
      eventBreakdown.push({
        eventId: evt._id,
        eventTitle: evt.title,
        eventDate: evt.date,
        points: pts,
        placement
      });
    }
    totalEventPoints += pts;
  }

  // Sort events by date descending
  eventBreakdown.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));

  // Get wins/losses/matchesPlayed for this player in this season
  const completedMatches = await getAll(() => db.collection('matches')
    .where({ seasonId, status: 'completed' }));
  const matchIds = completedMatches.map(m => m._id);

  const results = await batchIn('results', 'matchId', matchIds);

  let wins = 0;
  let matchesPlayed = 0;
  for (const match of completedMatches) {
    const players = [...(match.teamA || []), ...(match.teamB || [])];
    if (players.includes(playerId)) {
      matchesPlayed++;
    }
  }
  for (const result of results) {
    const winners = result.winnerPlayers || [];
    if (winners.includes(playerId)) {
      wins++;
    }
  }
  const losses = matchesPlayed - wins;

  const adjustmentData = await getAll(() => db.collection('season_point_adjustments')
    .where({ seasonId, playerId }));
  const adjustmentPoints = adjustmentData.reduce(
    (sum, item) => sum + (Number(item.deltaPoints) || 0),
    0
  );

  const points = totalEventPoints + adjustmentPoints;

  return {
    season,
    stats: {
      seasonId,
      playerId,
      points,
      eventPoints: totalEventPoints,
      adjustmentPoints,
      eventBreakdown,
      wins,
      losses,
      matchesPlayed
    }
  };
};
