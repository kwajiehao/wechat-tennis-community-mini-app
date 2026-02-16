// ABOUTME: Tests for the matchup generation algorithm.
// ABOUTME: Covers distribution planning, gender enforcement, partner uniqueness, and team balance.

const {
  ntrpToUTR,
  getUTR,
  classifyPlayers,
  planMatchDistribution,
  generateConstrainedMatchups
} = require('./matchupEngine');

// --- Test helpers ---

function makePlayer(id, gender, ntrp) {
  return { _id: id, gender, ntrp, name: id };
}

function makeMales(count, startNtrp = 3.0, step = 0.5) {
  return Array.from({ length: count }, (_, i) =>
    makePlayer(`m${i + 1}`, 'M', startNtrp + i * step)
  );
}

function makeFemales(count, startNtrp = 3.0, step = 0.5) {
  return Array.from({ length: count }, (_, i) =>
    makePlayer(`f${i + 1}`, 'F', startNtrp + i * step)
  );
}

function allDoubleTypes() {
  return ['mens_doubles', 'womens_doubles', 'mixed_doubles'];
}

// --- ntrpToUTR / getUTR ---

describe('ntrpToUTR', () => {
  test('converts NTRP 3.0 correctly', () => {
    expect(ntrpToUTR(3.0)).toBeCloseTo(6.0);
  });

  test('converts NTRP 4.0 correctly', () => {
    expect(ntrpToUTR(4.0)).toBeCloseTo(8.5);
  });

  test('defaults to NTRP 3.0 when null', () => {
    expect(ntrpToUTR(null)).toBeCloseTo(6.0);
  });

  test('defaults to NTRP 3.0 when undefined', () => {
    expect(ntrpToUTR(undefined)).toBeCloseTo(6.0);
  });
});

describe('getUTR', () => {
  test('returns NTRP-based UTR when no explicit UTR', () => {
    expect(getUTR({ ntrp: 4.0 })).toBeCloseTo(8.5);
  });

  test('averages NTRP-based and explicit UTR when both present', () => {
    expect(getUTR({ ntrp: 4.0, utr: 10.0 })).toBeCloseTo(9.25);
  });

  test('uses explicit UTR of 0 (not null)', () => {
    const result = getUTR({ ntrp: 4.0, utr: 0 });
    expect(result).toBeCloseTo(4.25);
  });
});

// --- classifyPlayers ---

describe('classifyPlayers', () => {
  test('separates males and females', () => {
    const players = [
      makePlayer('m1', 'M', 3.5),
      makePlayer('f1', 'F', 4.0),
      makePlayer('m2', 'M', 4.0),
    ];
    const { males, females } = classifyPlayers(players);
    expect(males.map(p => p._id)).toEqual(['m2', 'm1']);
    expect(females.map(p => p._id)).toEqual(['f1']);
  });

  test('sorts each group by UTR descending', () => {
    const players = [
      makePlayer('m1', 'M', 3.0),
      makePlayer('m2', 'M', 5.0),
      makePlayer('m3', 'M', 4.0),
    ];
    const { males } = classifyPlayers(players);
    expect(males.map(p => p._id)).toEqual(['m2', 'm3', 'm1']);
  });
});

// --- planMatchDistribution ---

describe('planMatchDistribution', () => {
  test('7M/2F: 5 mens, 4 mixed, 0 womens', () => {
    const result = planMatchDistribution(7, 2);
    expect(result.mensDoubles).toBe(5);
    expect(result.mixedDoubles).toBe(4);
    expect(result.womensDoubles).toBe(0);
  });

  test('6M/3F: 3 mens, 6 mixed, 0 womens', () => {
    const result = planMatchDistribution(6, 3);
    expect(result.mensDoubles).toBe(3);
    expect(result.mixedDoubles).toBe(6);
    expect(result.womensDoubles).toBe(0);
  });

  test('5M/4F: 3 mens, 4 mixed, 2 womens', () => {
    const result = planMatchDistribution(5, 4);
    expect(result.mensDoubles).toBe(3);
    expect(result.mixedDoubles).toBe(4);
    expect(result.womensDoubles).toBe(2);
  });

  test('no womens doubles when fewer than 4 women', () => {
    for (const femaleCount of [0, 1, 2, 3]) {
      const result = planMatchDistribution(6, femaleCount);
      expect(result.womensDoubles).toBe(0);
    }
  });

  test('no mens doubles when fewer than 4 men', () => {
    for (const maleCount of [0, 1, 2, 3]) {
      const result = planMatchDistribution(maleCount, 6);
      expect(result.mensDoubles).toBe(0);
    }
  });

  test('all counts are non-negative integers', () => {
    for (let m = 0; m <= 10; m++) {
      for (let f = 0; f <= 10; f++) {
        if (m + f < 4) continue;
        const result = planMatchDistribution(m, f);
        expect(result.mensDoubles).toBeGreaterThanOrEqual(0);
        expect(result.womensDoubles).toBeGreaterThanOrEqual(0);
        expect(result.mixedDoubles).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.mensDoubles)).toBe(true);
        expect(Number.isInteger(result.womensDoubles)).toBe(true);
        expect(Number.isInteger(result.mixedDoubles)).toBe(true);
      }
    }
  });

  test('slot math: female slots approximately equal femaleCount * target', () => {
    const scenarios = [
      [7, 2], [6, 3], [5, 4], [6, 6], [8, 4], [4, 4],
    ];
    for (const [m, f] of scenarios) {
      const result = planMatchDistribution(m, f);
      const target = result.targetMatchesPerPlayer;
      const femaleSlots = result.womensDoubles * 4 + result.mixedDoubles * 2;
      // Female slots should be within 2 of the ideal (rounding tolerance)
      expect(Math.abs(femaleSlots - f * target)).toBeLessThanOrEqual(2);
    }
  });

  test('slot math: male slots approximately equal maleCount * target', () => {
    const scenarios = [
      [7, 2], [6, 3], [5, 4], [6, 6], [8, 4], [4, 4],
    ];
    for (const [m, f] of scenarios) {
      const result = planMatchDistribution(m, f);
      const target = result.targetMatchesPerPlayer;
      const maleSlots = result.mensDoubles * 4 + result.mixedDoubles * 2;
      expect(Math.abs(maleSlots - m * target)).toBeLessThanOrEqual(2);
    }
  });

  test('6M/6F: follows slot-filling rules', () => {
    const result = planMatchDistribution(6, 6);
    expect(result.womensDoubles).toBeGreaterThanOrEqual(1);
    expect(result.mensDoubles).toBeGreaterThanOrEqual(1);
    expect(result.mixedDoubles).toBeGreaterThanOrEqual(1);
    expect(result.targetMatchesPerPlayer).toBe(4);
  });

  test('target is 3 for 6 or fewer players', () => {
    expect(planMatchDistribution(4, 2).targetMatchesPerPlayer).toBe(3);
    expect(planMatchDistribution(3, 3).targetMatchesPerPlayer).toBe(3);
  });

  test('target is 4 for more than 6 players', () => {
    expect(planMatchDistribution(5, 2).targetMatchesPerPlayer).toBe(4);
    expect(planMatchDistribution(4, 4).targetMatchesPerPlayer).toBe(4);
  });
});

// --- generateConstrainedMatchups integration tests ---

describe('generateConstrainedMatchups', () => {
  describe('gender enforcement', () => {
    test('mens_doubles matches contain only males', () => {
      const males = makeMales(7);
      const females = makeFemales(2);
      const players = [...males, ...females];
      const plan = planMatchDistribution(7, 2);
      const { matches } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      const maleIds = new Set(males.map(p => p._id));
      const mensMatches = matches.filter(m => m.matchType === 'mens_doubles');
      for (const match of mensMatches) {
        for (const id of [...match.teamA, ...match.teamB]) {
          expect(maleIds.has(id)).toBe(true);
        }
      }
    });

    test('womens_doubles matches contain only females', () => {
      const males = makeMales(5);
      const females = makeFemales(4);
      const players = [...males, ...females];
      const plan = planMatchDistribution(5, 4);
      const { matches } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      const femaleIds = new Set(females.map(p => p._id));
      const womensMatches = matches.filter(m => m.matchType === 'womens_doubles');
      for (const match of womensMatches) {
        for (const id of [...match.teamA, ...match.teamB]) {
          expect(femaleIds.has(id)).toBe(true);
        }
      }
    });

    test('mixed_doubles teams each have one male and one female', () => {
      const males = makeMales(5);
      const females = makeFemales(4);
      const players = [...males, ...females];
      const plan = planMatchDistribution(5, 4);
      const { matches } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      const maleIds = new Set(males.map(p => p._id));
      const femaleIds = new Set(females.map(p => p._id));
      const mixedMatches = matches.filter(m => m.matchType === 'mixed_doubles');
      for (const match of mixedMatches) {
        for (const team of [match.teamA, match.teamB]) {
          const teamMales = team.filter(id => maleIds.has(id));
          const teamFemales = team.filter(id => femaleIds.has(id));
          expect(teamMales.length).toBe(1);
          expect(teamFemales.length).toBe(1);
        }
      }
    });
  });

  describe('partner uniqueness', () => {
    test('no repeated partners across all matches', () => {
      const males = makeMales(7);
      const females = makeFemales(3);
      const players = [...males, ...females];
      const plan = planMatchDistribution(7, 3);
      const { matches } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      const partnerships = new Set();
      for (const match of matches) {
        for (const team of [match.teamA, match.teamB]) {
          if (team.length === 2) {
            const key = [team[0], team[1]].sort().join('-');
            expect(partnerships.has(key)).toBe(false);
            partnerships.add(key);
          }
        }
      }
    });
  });

  describe('match count per player', () => {
    test('no player has 0 matches (9 players)', () => {
      const males = makeMales(6);
      const females = makeFemales(3);
      const players = [...males, ...females];
      const plan = planMatchDistribution(6, 3);
      const { matchCounts } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      for (const player of players) {
        expect(matchCounts.get(player._id)).toBeGreaterThan(0);
      }
    });

    test('each player plays approximately target matches', () => {
      const males = makeMales(7);
      const females = makeFemales(2);
      const players = [...males, ...females];
      const plan = planMatchDistribution(7, 2);
      const { matchCounts } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      for (const player of players) {
        const count = matchCounts.get(player._id);
        // Allow +/-2 from target as tolerance
        expect(count).toBeGreaterThanOrEqual(plan.targetMatchesPerPlayer - 2);
        expect(count).toBeLessThanOrEqual(plan.targetMatchesPerPlayer + 1);
      }
    });
  });

  describe('team balance', () => {
    test('combined UTR difference between teams is within threshold', () => {
      const males = makeMales(7, 2.0, 0.5);
      const females = makeFemales(3, 2.5, 0.5);
      const players = [...males, ...females];
      const plan = planMatchDistribution(7, 3);
      const { matches } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      for (const match of matches) {
        const teamAUTR = match.teamA.reduce((sum, id) => {
          const p = players.find(p => p._id === id);
          return sum + getUTR(p);
        }, 0);
        const teamBUTR = match.teamB.reduce((sum, id) => {
          const p = players.find(p => p._id === id);
          return sum + getUTR(p);
        }, 0);
        const diff = Math.abs(teamAUTR - teamBUTR);
        // Combined UTR difference should be reasonable (within 5.0)
        expect(diff).toBeLessThan(5.0);
      }
    });
  });
});

// --- Edge cases ---

describe('edge cases', () => {
  test('all males, no females', () => {
    const males = makeMales(8);
    const plan = planMatchDistribution(8, 0);
    expect(plan.womensDoubles).toBe(0);
    expect(plan.mixedDoubles).toBe(0);
    expect(plan.mensDoubles).toBeGreaterThan(0);

    const { matches } = generateConstrainedMatchups(males, plan, allDoubleTypes());
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.matchType).toBe('mens_doubles');
    }
  });

  test('all females, no males', () => {
    const females = makeFemales(8);
    const plan = planMatchDistribution(0, 8);
    expect(plan.mensDoubles).toBe(0);
    expect(plan.mixedDoubles).toBe(0);
    expect(plan.womensDoubles).toBeGreaterThan(0);

    const { matches } = generateConstrainedMatchups(females, plan, allDoubleTypes());
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.matchType).toBe('womens_doubles');
    }
  });

  test('small group: 4 players (2M/2F)', () => {
    const males = makeMales(2);
    const females = makeFemales(2);
    const players = [...males, ...females];
    const plan = planMatchDistribution(2, 2);
    const { matches } = generateConstrainedMatchups(players, plan, allDoubleTypes());
    // Should produce at least some matches
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test('restricted to only mixed doubles', () => {
    const males = makeMales(5);
    const females = makeFemales(4);
    const players = [...males, ...females];
    const plan = planMatchDistribution(5, 4);
    const { matches } = generateConstrainedMatchups(players, plan, ['mixed_doubles']);

    for (const match of matches) {
      expect(match.matchType).toBe('mixed_doubles');
    }
  });
});
