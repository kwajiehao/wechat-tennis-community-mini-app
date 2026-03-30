// ABOUTME: Tests season match stat aggregation against duplicate and malformed result data.

const { computeSeasonMatchStats } = require('./seasonStats');

describe('computeSeasonMatchStats', () => {
  it('counts one match played per rostered player', () => {
    const matches = [
      { _id: 'm1', teamA: ['p1'], teamB: ['p2'] }
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] }
    ];

    expect(computeSeasonMatchStats(matches, results)).toEqual({
      p1: { matchesPlayed: 1, wins: 1, losses: 0 },
      p2: { matchesPlayed: 1, wins: 0, losses: 1 }
    });
  });

  it('deduplicates duplicate results for the same match', () => {
    const matches = [
      { _id: 'm1', teamA: ['p1'], teamB: ['p2'] }
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
      { matchId: 'm1', winnerPlayers: ['p1'] }
    ];

    expect(computeSeasonMatchStats(matches, results)).toEqual({
      p1: { matchesPlayed: 1, wins: 1, losses: 0 },
      p2: { matchesPlayed: 1, wins: 0, losses: 1 }
    });
  });

  it('ignores winner ids that are not on the completed match roster', () => {
    const matches = [
      { _id: 'm1', teamA: ['p1'], teamB: ['p2'] }
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p3'] }
    ];

    expect(computeSeasonMatchStats(matches, results)).toEqual({
      p1: { matchesPlayed: 1, wins: 0, losses: 1 },
      p2: { matchesPlayed: 1, wins: 0, losses: 1 }
    });
  });

  it('never returns negative losses even when malformed results credit both sides', () => {
    const matches = [
      { _id: 'm1', teamA: ['p1'], teamB: ['p2'] }
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
      { matchId: 'm1', winnerPlayers: ['p2'] }
    ];

    expect(computeSeasonMatchStats(matches, results)).toEqual({
      p1: { matchesPlayed: 1, wins: 1, losses: 0 },
      p2: { matchesPlayed: 1, wins: 1, losses: 0 }
    });
  });
});
