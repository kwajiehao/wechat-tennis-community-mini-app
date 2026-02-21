// ABOUTME: Tests for perfect event counting logic.
// ABOUTME: Validates that players with 100% win rate in an event are correctly identified.

const { computePerfectEventCounts } = require('./perfectEvents');

describe('computePerfectEventCounts', () => {
  it('counts a perfect event when player wins all matches', () => {
    const matches = [
      { _id: 'm1', eventId: 'e1', teamA: ['p1'], teamB: ['p2'] },
      { _id: 'm2', eventId: 'e1', teamA: ['p1'], teamB: ['p3'] },
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
      { matchId: 'm2', winnerPlayers: ['p1'] },
    ];
    const scoredEventIds = new Set(['e1']);

    const counts = computePerfectEventCounts(matches, results, scoredEventIds);
    expect(counts['p1']).toBe(1);
    expect(counts['p2']).toBeUndefined();
    expect(counts['p3']).toBeUndefined();
  });

  it('does not count an event where player lost a match', () => {
    const matches = [
      { _id: 'm1', eventId: 'e1', teamA: ['p1'], teamB: ['p2'] },
      { _id: 'm2', eventId: 'e1', teamA: ['p1'], teamB: ['p3'] },
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
      { matchId: 'm2', winnerPlayers: ['p3'] },
    ];
    const scoredEventIds = new Set(['e1']);

    const counts = computePerfectEventCounts(matches, results, scoredEventIds);
    expect(counts['p1']).toBeUndefined();
  });

  it('counts across multiple events independently', () => {
    const matches = [
      { _id: 'm1', eventId: 'e1', teamA: ['p1'], teamB: ['p2'] },
      { _id: 'm2', eventId: 'e2', teamA: ['p1'], teamB: ['p2'] },
      { _id: 'm3', eventId: 'e2', teamA: ['p1'], teamB: ['p3'] },
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
      { matchId: 'm2', winnerPlayers: ['p2'] },
      { matchId: 'm3', winnerPlayers: ['p1'] },
    ];
    const scoredEventIds = new Set(['e1', 'e2']);

    const counts = computePerfectEventCounts(matches, results, scoredEventIds);
    // p1: perfect in e1 (1/1 wins), not perfect in e2 (1/2 wins)
    expect(counts['p1']).toBe(1);
    // p2: lost in e1 (not perfect), but only played m2 in e2 and won → perfect in e2
    expect(counts['p2']).toBe(1);
  });

  it('ignores events that are not in scoredEventIds', () => {
    const matches = [
      { _id: 'm1', eventId: 'e1', teamA: ['p1'], teamB: ['p2'] },
      { _id: 'm2', eventId: 'e2', teamA: ['p1'], teamB: ['p2'] },
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
      { matchId: 'm2', winnerPlayers: ['p1'] },
    ];
    // Only e1 is scored
    const scoredEventIds = new Set(['e1']);

    const counts = computePerfectEventCounts(matches, results, scoredEventIds);
    // p1 is perfect in e1 only (e2 not scored)
    expect(counts['p1']).toBe(1);
  });

  it('handles doubles matches (both winners get credit)', () => {
    const matches = [
      { _id: 'm1', eventId: 'e1', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] },
      { _id: 'm2', eventId: 'e1', teamA: ['p1', 'p3'], teamB: ['p2', 'p4'] },
    ];
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1', 'p2'] },
      { matchId: 'm2', winnerPlayers: ['p1', 'p3'] },
    ];
    const scoredEventIds = new Set(['e1']);

    const counts = computePerfectEventCounts(matches, results, scoredEventIds);
    // p1: won both matches → perfect
    expect(counts['p1']).toBe(1);
    // p2: won m1, lost m2 → not perfect
    expect(counts['p2']).toBeUndefined();
    // p3: lost m1, won m2 → not perfect
    expect(counts['p3']).toBeUndefined();
  });

  it('returns empty object when no matches', () => {
    const counts = computePerfectEventCounts([], [], new Set());
    expect(counts).toEqual({});
  });

  it('does not count a match without a result', () => {
    const matches = [
      { _id: 'm1', eventId: 'e1', teamA: ['p1'], teamB: ['p2'] },
      { _id: 'm2', eventId: 'e1', teamA: ['p1'], teamB: ['p3'] },
    ];
    // Only m1 has a result
    const results = [
      { matchId: 'm1', winnerPlayers: ['p1'] },
    ];
    const scoredEventIds = new Set(['e1']);

    const counts = computePerfectEventCounts(matches, results, scoredEventIds);
    // p1 played 2 matches but only won 1 (m2 has no result, so 0 wins there)
    expect(counts['p1']).toBeUndefined();
  });
});
