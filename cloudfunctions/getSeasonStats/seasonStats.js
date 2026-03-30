// ABOUTME: Pure helpers for deriving season match stats from matches and results.
// ABOUTME: Deduplicates duplicate result rows per match and ignores malformed winners not on the roster.

function getMatchParticipants(match) {
  return new Set([...(match.teamA || []), ...(match.teamB || [])]);
}

function computeSeasonMatchStats(completedMatches, results) {
  const playerWins = {};
  const playerMatchesPlayed = {};
  const participantsByMatchId = new Map();
  const creditedWins = new Set();

  for (const match of completedMatches || []) {
    const participants = getMatchParticipants(match);
    participantsByMatchId.set(match._id, participants);

    for (const playerId of participants) {
      playerMatchesPlayed[playerId] = (playerMatchesPlayed[playerId] || 0) + 1;
    }
  }

  for (const result of results || []) {
    const participants = participantsByMatchId.get(result.matchId);
    if (!participants) continue;

    for (const playerId of result.winnerPlayers || []) {
      if (!participants.has(playerId)) continue;

      const winKey = `${result.matchId}:${playerId}`;
      if (creditedWins.has(winKey)) continue;

      creditedWins.add(winKey);
      playerWins[playerId] = (playerWins[playerId] || 0) + 1;
    }
  }

  const statsByPlayer = {};
  const playerIds = new Set([
    ...Object.keys(playerMatchesPlayed),
    ...Object.keys(playerWins)
  ]);

  for (const playerId of playerIds) {
    const matchesPlayed = playerMatchesPlayed[playerId] || 0;
    const wins = playerWins[playerId] || 0;
    statsByPlayer[playerId] = {
      matchesPlayed,
      wins,
      losses: Math.max(0, matchesPlayed - wins)
    };
  }

  return statsByPlayer;
}

module.exports = {
  computeSeasonMatchStats
};
