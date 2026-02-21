// ABOUTME: Counts events where a player won 100% of their matches.
// ABOUTME: Used by season leaderboard to display perfect event counts.

/**
 * Computes how many "perfect events" each player has — events where
 * the player won every match they played.
 *
 * @param {Array} completedMatches - Matches with _id, eventId, teamA, teamB
 * @param {Array} results - Results with matchId, winnerPlayers
 * @param {Set} scoredEventIds - Event IDs with computed leaderboards
 * @returns {Object} Map of playerId → number of perfect events
 */
function computePerfectEventCounts(completedMatches, results, scoredEventIds) {
  const resultMap = new Map(results.map(r => [r.matchId, r]));

  // Group matches by eventId, only considering scored events
  const matchesByEvent = {};
  for (const match of completedMatches) {
    if (!scoredEventIds.has(match.eventId)) continue;
    if (!matchesByEvent[match.eventId]) matchesByEvent[match.eventId] = [];
    matchesByEvent[match.eventId].push(match);
  }

  const perfectEventCounts = {};

  for (const eventMatches of Object.values(matchesByEvent)) {
    const playerMatchCount = {};
    const playerWinCount = {};

    for (const match of eventMatches) {
      const players = [...(match.teamA || []), ...(match.teamB || [])];
      for (const pid of players) {
        playerMatchCount[pid] = (playerMatchCount[pid] || 0) + 1;
      }
      const result = resultMap.get(match._id);
      if (result) {
        for (const pid of (result.winnerPlayers || [])) {
          playerWinCount[pid] = (playerWinCount[pid] || 0) + 1;
        }
      }
    }

    for (const [pid, matchCount] of Object.entries(playerMatchCount)) {
      if ((playerWinCount[pid] || 0) === matchCount && matchCount > 0) {
        perfectEventCounts[pid] = (perfectEventCounts[pid] || 0) + 1;
      }
    }
  }

  return perfectEventCounts;
}

module.exports = { computePerfectEventCounts };
