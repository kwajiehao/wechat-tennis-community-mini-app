// ABOUTME: Tests for the matchup generation algorithm.
// ABOUTME: Covers distribution planning, gender enforcement, partner uniqueness, and team balance.

const {
  ntrpToUTR,
  getUTR,
  classifyPlayers,
  planMatchDistribution,
  generateConstrainedMatchups,
  generateSinglesMatchups,
  pickBestSinglesPair,
  combinations
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
      const males = makeMales(7, 3.0, 0.25);
      const females = makeFemales(3, 3.0, 0.25);
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
        // Eligible pool + balanced splits should keep diff under 3.0
        expect(diff).toBeLessThan(3.0);
      }
    });

    test('balance optimization picks better split than arbitrary pairing', () => {
      // 4 males with known UTRs: wide spread to demonstrate balance matters
      const players = [
        makePlayer('a', 'M', 2.0),  // UTR 3.5
        makePlayer('b', 'M', 3.0),  // UTR 6.0
        makePlayer('c', 'M', 4.0),  // UTR 8.5
        makePlayer('d', 'M', 5.0),  // UTR 11.0
      ];
      const plan = { mensDoubles: 1, womensDoubles: 0, mixedDoubles: 0, targetMatchesPerPlayer: 3 };
      const { matches } = generateConstrainedMatchups(players, plan, ['mens_doubles']);

      expect(matches).toHaveLength(1);
      const match = matches[0];
      const utrOf = id => getUTR(players.find(p => p._id === id));
      const teamAUTR = match.teamA.reduce((sum, id) => sum + utrOf(id), 0);
      const teamBUTR = match.teamB.reduce((sum, id) => sum + utrOf(id), 0);
      const diff = Math.abs(teamAUTR - teamBUTR);
      // Best split: (a+d)=14.5 vs (b+c)=14.5 → diff=0
      // Worst split: (a+b)=9.5 vs (c+d)=19.5 → diff=10
      expect(diff).toBeLessThanOrEqual(1.0);
    });

    test('6M/3F: females partner with diverse males in mixed doubles', () => {
      const males = makeMales(6, 3.0, 0.25);
      const females = makeFemales(3, 3.0, 0.5);
      const players = [...males, ...females];
      const plan = planMatchDistribution(6, 3);
      const { matches, matchCounts } = generateConstrainedMatchups(players, plan, allDoubleTypes());

      // Every player plays exactly the target number of matches
      for (const p of players) {
        expect(matchCounts.get(p._id)).toBe(plan.targetMatchesPerPlayer);
      }

      // Each female partners with at least 3 distinct males across mixed doubles
      const maleIds = new Set(males.map(m => m._id));
      const femalePartners = new Map(females.map(f => [f._id, new Set()]));
      for (const m of matches.filter(m => m.matchType === 'mixed_doubles')) {
        for (const team of [m.teamA, m.teamB]) {
          const fId = team.find(id => !maleIds.has(id));
          const mId = team.find(id => maleIds.has(id));
          if (fId && mId) femalePartners.get(fId).add(mId);
        }
      }
      for (const [, partners] of femalePartners) {
        expect(partners.size).toBeGreaterThanOrEqual(3);
      }
    });

    test('eligible pool selects UTR-balanced group from 6+ candidates', () => {
      // 8 males with wide NTRP spread; eligible pool should pick
      // a balanced group, not just the 4 with fewest matches
      const players = [
        makePlayer('m1', 'M', 2.0),  // UTR 3.5
        makePlayer('m2', 'M', 2.5),  // UTR 4.75
        makePlayer('m3', 'M', 3.0),  // UTR 6.0
        makePlayer('m4', 'M', 3.5),  // UTR 7.25
        makePlayer('m5', 'M', 4.0),  // UTR 8.5
        makePlayer('m6', 'M', 4.5),  // UTR 9.75
        makePlayer('m7', 'M', 5.0),  // UTR 11.0
        makePlayer('m8', 'M', 5.5),  // UTR 12.25
      ];
      const plan = { mensDoubles: 8, womensDoubles: 0, mixedDoubles: 0, targetMatchesPerPlayer: 4 };
      const { matches } = generateConstrainedMatchups(players, plan, ['mens_doubles']);

      const utrOf = id => getUTR(players.find(p => p._id === id));
      for (const match of matches) {
        const teamAUTR = match.teamA.reduce((sum, id) => sum + utrOf(id), 0);
        const teamBUTR = match.teamB.reduce((sum, id) => sum + utrOf(id), 0);
        const diff = Math.abs(teamAUTR - teamBUTR);
        // Eligible pool + balanced splits should keep diff under 3.0
        expect(diff).toBeLessThan(3.0);
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

  test('1M/1F: too few for any doubles', () => {
    const plan = planMatchDistribution(1, 1);
    expect(plan.mensDoubles).toBe(0);
    expect(plan.womensDoubles).toBe(0);
    expect(plan.mixedDoubles).toBe(0);
  });

  test('3M/1F: only mens doubles possible', () => {
    const plan = planMatchDistribution(3, 1);
    expect(plan.womensDoubles).toBe(0);
    expect(plan.mixedDoubles).toBe(0);
    // Not enough men for doubles either (need 4)
    expect(plan.mensDoubles).toBe(0);
  });

  test('4M/0F: mens doubles only, no mixed or womens', () => {
    const males = makeMales(4);
    const plan = planMatchDistribution(4, 0);
    expect(plan.mixedDoubles).toBe(0);
    expect(plan.womensDoubles).toBe(0);
    expect(plan.mensDoubles).toBeGreaterThan(0);

    const { matches } = generateConstrainedMatchups(males, plan, allDoubleTypes());
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.matchType).toBe('mens_doubles');
    }
  });

  test('0M/4F: womens doubles only', () => {
    const females = makeFemales(4);
    const plan = planMatchDistribution(0, 4);
    expect(plan.mixedDoubles).toBe(0);
    expect(plan.mensDoubles).toBe(0);
    expect(plan.womensDoubles).toBeGreaterThan(0);

    const { matches } = generateConstrainedMatchups(females, plan, allDoubleTypes());
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      expect(match.matchType).toBe('womens_doubles');
    }
  });

  test('empty player list produces no matches', () => {
    const plan = planMatchDistribution(0, 0);
    expect(plan.mensDoubles).toBe(0);
    expect(plan.womensDoubles).toBe(0);
    expect(plan.mixedDoubles).toBe(0);

    const { matches } = generateConstrainedMatchups([], plan, allDoubleTypes());
    expect(matches).toHaveLength(0);
  });

  test('all same NTRP: no crashes, partner uniqueness preserved', () => {
    const males = Array.from({ length: 8 }, (_, i) =>
      makePlayer(`m${i + 1}`, 'M', 3.5)
    );
    const plan = planMatchDistribution(8, 0);
    const { matches } = generateConstrainedMatchups(males, plan, ['mens_doubles']);

    expect(matches.length).toBeGreaterThan(0);

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

  test('partner uniqueness holds with eligible pool (large candidate set)', () => {
    const males = makeMales(10, 2.5, 0.3);
    const females = makeFemales(5, 3.0, 0.25);
    const players = [...males, ...females];
    const plan = planMatchDistribution(10, 5);
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

// --- pickBestSinglesPair ---

describe('pickBestSinglesPair', () => {
  test('returns pair with smallest UTR difference', () => {
    const players = [
      makePlayer('p1', 'M', 3.0),
      makePlayer('p2', 'M', 3.5),
      makePlayer('p3', 'M', 5.0),
    ];
    const usedOpponents = new Map(players.map(p => [p._id, new Set()]));
    const matchCounts = new Map(players.map(p => [p._id, 0]));
    const playerLookup = new Map(players.map(p => [p._id, p]));

    const pair = pickBestSinglesPair(players, usedOpponents, matchCounts, playerLookup);
    expect(pair).not.toBeNull();
    // p1 (UTR 6.0) and p2 (UTR 7.25) are closest
    expect(pair.sort()).toEqual(['p1', 'p2'].sort());
  });

  test('skips pairs that already played each other', () => {
    const players = [
      makePlayer('p1', 'M', 3.0),
      makePlayer('p2', 'M', 3.5),
      makePlayer('p3', 'M', 5.0),
    ];
    const usedOpponents = new Map([
      ['p1', new Set(['p2'])],
      ['p2', new Set(['p1'])],
      ['p3', new Set()]
    ]);
    const matchCounts = new Map(players.map(p => [p._id, 0]));
    const playerLookup = new Map(players.map(p => [p._id, p]));

    const pair = pickBestSinglesPair(players, usedOpponents, matchCounts, playerLookup);
    expect(pair).not.toBeNull();
    // p1-p2 already played, so the pair must include p3
    expect(pair.includes('p3')).toBe(true);
    // And must not be the p1-p2 pair
    expect(pair.sort().join('-')).not.toBe('p1-p2');
  });

  test('returns null when no valid pairs exist', () => {
    const players = [
      makePlayer('p1', 'M', 3.0),
      makePlayer('p2', 'M', 3.5),
    ];
    const usedOpponents = new Map([
      ['p1', new Set(['p2'])],
      ['p2', new Set(['p1'])]
    ]);
    const matchCounts = new Map(players.map(p => [p._id, 0]));
    const playerLookup = new Map(players.map(p => [p._id, p]));

    const pair = pickBestSinglesPair(players, usedOpponents, matchCounts, playerLookup);
    expect(pair).toBeNull();
  });

  test('prioritizes players with fewer matches', () => {
    const players = [
      makePlayer('p1', 'M', 3.0),
      makePlayer('p2', 'M', 3.0),
      makePlayer('p3', 'M', 3.0),
      makePlayer('p4', 'M', 3.0),
    ];
    const usedOpponents = new Map(players.map(p => [p._id, new Set()]));
    const matchCounts = new Map([
      ['p1', 0], ['p2', 0], ['p3', 3], ['p4', 3]
    ]);
    const playerLookup = new Map(players.map(p => [p._id, p]));

    const pair = pickBestSinglesPair(players, usedOpponents, matchCounts, playerLookup);
    expect(pair).not.toBeNull();
    // Should prefer p1 and p2 who have 0 matches
    expect(pair.sort()).toEqual(['p1', 'p2'].sort());
  });

  test('eligible pool constrains to low-count players over UTR-optimal pair', () => {
    // p3 and p4 have closest UTR but high match counts
    // Eligible pool (count ≤ min+1 = 1) should exclude them
    const players = [
      makePlayer('p1', 'M', 2.0),  // UTR 3.5, count 0
      makePlayer('p2', 'M', 3.5),  // UTR 7.25, count 0
      makePlayer('p3', 'M', 4.0),  // UTR 8.5, count 3
      makePlayer('p4', 'M', 4.5),  // UTR 9.75, count 3
    ];
    const usedOpponents = new Map(players.map(p => [p._id, new Set()]));
    const matchCounts = new Map([
      ['p1', 0], ['p2', 0], ['p3', 3], ['p4', 3]
    ]);
    const playerLookup = new Map(players.map(p => [p._id, p]));

    const pair = pickBestSinglesPair(players, usedOpponents, matchCounts, playerLookup);
    expect(pair).not.toBeNull();
    // Should pick p1+p2 (eligible pool), not p3+p4 (closest UTR but high count)
    expect(pair.sort()).toEqual(['p1', 'p2'].sort());
  });
});

// --- generateSinglesMatchups ---

describe('generateSinglesMatchups', () => {
  describe('basic match shape', () => {
    test('all matches have matchType "singles" and single-player teams', () => {
      const players = [
        makePlayer('p1', 'M', 3.0),
        makePlayer('p2', 'F', 3.5),
        makePlayer('p3', 'M', 4.0),
        makePlayer('p4', 'F', 4.5),
      ];
      const { matches } = generateSinglesMatchups(players);

      for (const match of matches) {
        expect(match.matchType).toBe('singles');
        expect(match.teamA).toHaveLength(1);
        expect(match.teamB).toHaveLength(1);
      }
    });

    test('matchCounts tracks all players', () => {
      const players = [
        makePlayer('p1', 'M', 3.0),
        makePlayer('p2', 'F', 3.5),
        makePlayer('p3', 'M', 4.0),
      ];
      const { matchCounts } = generateSinglesMatchups(players);

      for (const player of players) {
        expect(matchCounts.has(player._id)).toBe(true);
      }
    });
  });

  describe('match count targets', () => {
    test('2 players produce 1 match', () => {
      const players = [
        makePlayer('p1', 'M', 3.0),
        makePlayer('p2', 'F', 3.5),
      ];
      const { matches } = generateSinglesMatchups(players);
      expect(matches).toHaveLength(1);
    });

    test('3 players produce triangle: each plays 2 matches', () => {
      const players = [
        makePlayer('p1', 'M', 3.0),
        makePlayer('p2', 'F', 3.5),
        makePlayer('p3', 'M', 4.0),
      ];
      const { matches, matchCounts } = generateSinglesMatchups(players);
      expect(matches).toHaveLength(3);
      for (const player of players) {
        expect(matchCounts.get(player._id)).toBe(2);
      }
    });

    test('6 players target 3 matches each', () => {
      const players = Array.from({ length: 6 }, (_, i) =>
        makePlayer(`p${i + 1}`, i % 2 === 0 ? 'M' : 'F', 3.0 + i * 0.25)
      );
      const { matchCounts } = generateSinglesMatchups(players);
      for (const player of players) {
        expect(matchCounts.get(player._id)).toBeLessThanOrEqual(3);
        expect(matchCounts.get(player._id)).toBeGreaterThanOrEqual(2);
      }
    });

    test('8 players target 4 matches each', () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        makePlayer(`p${i + 1}`, i % 2 === 0 ? 'M' : 'F', 3.0 + i * 0.25)
      );
      const { matchCounts } = generateSinglesMatchups(players);
      for (const player of players) {
        expect(matchCounts.get(player._id)).toBeLessThanOrEqual(4);
        expect(matchCounts.get(player._id)).toBeGreaterThanOrEqual(2);
      }
    });

    test('no player exceeds target match count', () => {
      const players = Array.from({ length: 10 }, (_, i) =>
        makePlayer(`p${i + 1}`, i % 2 === 0 ? 'M' : 'F', 3.0 + i * 0.1)
      );
      const target = 4; // >6 players
      const { matchCounts } = generateSinglesMatchups(players);
      for (const player of players) {
        expect(matchCounts.get(player._id)).toBeLessThanOrEqual(target);
      }
    });
  });

  describe('opponent uniqueness', () => {
    test('no rematches across all matches', () => {
      const players = Array.from({ length: 8 }, (_, i) =>
        makePlayer(`p${i + 1}`, i % 2 === 0 ? 'M' : 'F', 3.0 + i * 0.25)
      );
      const { matches } = generateSinglesMatchups(players);

      const pairings = new Set();
      for (const match of matches) {
        const key = [match.teamA[0], match.teamB[0]].sort().join('-');
        expect(pairings.has(key)).toBe(false);
        pairings.add(key);
      }
    });
  });

  describe('UTR balancing', () => {
    test('prefers closer-rated pairings', () => {
      // 4 players with spread ratings
      const players = [
        makePlayer('low1', 'M', 2.0),   // UTR 3.5
        makePlayer('low2', 'M', 2.5),   // UTR 4.75
        makePlayer('high1', 'M', 4.5),  // UTR 9.75
        makePlayer('high2', 'M', 5.0),  // UTR 11.0
      ];
      const { matches } = generateSinglesMatchups(players);

      // First matches should pair close ratings: low1-low2 and high1-high2
      const firstPairings = matches.slice(0, 2).map(m =>
        [m.teamA[0], m.teamB[0]].sort().join('-')
      );
      const hasClosePair = firstPairings.some(p =>
        p === 'low1-low2' || p === 'high1-high2'
      );
      expect(hasClosePair).toBe(true);
    });
  });

  describe('gender neutrality', () => {
    test('cross-gender pairings happen', () => {
      const players = [
        makePlayer('m1', 'M', 3.0),
        makePlayer('f1', 'F', 3.0),
        makePlayer('m2', 'M', 3.5),
        makePlayer('f2', 'F', 3.5),
      ];
      const { matches } = generateSinglesMatchups(players);

      const hasCrossGender = matches.some(m => {
        const a = players.find(p => p._id === m.teamA[0]);
        const b = players.find(p => p._id === m.teamB[0]);
        return a.gender !== b.gender;
      });
      expect(hasCrossGender).toBe(true);
    });

    test('all-male group works', () => {
      const players = makeMales(6);
      const { matches } = generateSinglesMatchups(players);
      expect(matches.length).toBeGreaterThan(0);
    });

    test('all-female group works', () => {
      const players = makeFemales(6);
      const { matches } = generateSinglesMatchups(players);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    test('0 players returns empty', () => {
      const { matches, matchCounts } = generateSinglesMatchups([]);
      expect(matches).toHaveLength(0);
      expect(matchCounts.size).toBe(0);
    });

    test('1 player returns no matches', () => {
      const players = [makePlayer('p1', 'M', 3.0)];
      const { matches } = generateSinglesMatchups(players);
      expect(matches).toHaveLength(0);
    });

    test('players with identical NTRP get paired', () => {
      const players = [
        makePlayer('p1', 'M', 3.5),
        makePlayer('p2', 'F', 3.5),
        makePlayer('p3', 'M', 3.5),
        makePlayer('p4', 'F', 3.5),
      ];
      const { matches } = generateSinglesMatchups(players);
      expect(matches.length).toBeGreaterThan(0);
    });

    test('15 players stress test: reasonable match counts, no crashes', () => {
      const players = Array.from({ length: 15 }, (_, i) =>
        makePlayer(`p${i + 1}`, i % 2 === 0 ? 'M' : 'F', 2.5 + (i % 5) * 0.5)
      );
      const { matches, matchCounts } = generateSinglesMatchups(players);
      expect(matches.length).toBeGreaterThan(0);

      // No rematches
      const pairings = new Set();
      for (const match of matches) {
        const key = [match.teamA[0], match.teamB[0]].sort().join('-');
        expect(pairings.has(key)).toBe(false);
        pairings.add(key);
      }

      // No player exceeds target
      const target = 4;
      for (const player of players) {
        expect(matchCounts.get(player._id)).toBeLessThanOrEqual(target);
      }
    });
  });
});

// --- combinations utility ---

describe('combinations', () => {
  test('C(4,2) returns 6 pairs', () => {
    const result = combinations([1, 2, 3, 4], 2);
    expect(result).toHaveLength(6);
    expect(result).toEqual(expect.arrayContaining([
      [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]
    ]));
  });

  test('C(5,4) returns 5 groups', () => {
    const result = combinations(['a', 'b', 'c', 'd', 'e'], 4);
    expect(result).toHaveLength(5);
  });

  test('C(n,n) returns single group with all elements', () => {
    const result = combinations([1, 2, 3], 3);
    expect(result).toEqual([[1, 2, 3]]);
  });

  test('C(n,1) returns n singletons', () => {
    const result = combinations([1, 2, 3], 1);
    expect(result).toEqual([[1], [2], [3]]);
  });

  test('k > n returns empty', () => {
    const result = combinations([1, 2], 3);
    expect(result).toEqual([]);
  });

  test('C(6,4) returns 15 groups', () => {
    const result = combinations([1, 2, 3, 4, 5, 6], 4);
    expect(result).toHaveLength(15);
  });
});
