// ABOUTME: Pure matchup generation algorithm — distribution planning, team formation, and pairing.
// ABOUTME: Decoupled from WeChat cloud SDK for testability.

const VALID_MATCH_TYPES = [
  'singles',
  'mens_singles',
  'womens_singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles'
];

function combinations(arr, k) {
  if (k > arr.length) return [];
  if (k === arr.length) return [arr.slice()];
  if (k === 1) return arr.map(x => [x]);
  const result = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

function ntrpToUTR(ntrp) {
  return 1.0 + ((ntrp || 3.0) - 1.0) * 2.5;
}

function getUTR(player) {
  const ntrpBased = ntrpToUTR(player.ntrp);
  if (player.utr == null) return ntrpBased;
  return (ntrpBased + player.utr) / 2;
}

function classifyPlayers(players) {
  const males = players.filter(p => (p.gender || '').toUpperCase() === 'M')
    .sort((a, b) => getUTR(b) - getUTR(a));
  const females = players.filter(p => (p.gender || '').toUpperCase() === 'F')
    .sort((a, b) => getUTR(b) - getUTR(a));
  return { males, females };
}

function planMatchDistribution(maleCount, femaleCount) {
  const totalPlayers = maleCount + femaleCount;
  const targetMatchesPerPlayer = totalPlayers <= 6 ? 3 : 4;

  let womensDoubles = 0, mixedDoubles = 0, mensDoubles = 0;

  // Each WD match uses 4 female slots, each XD match uses 2 female + 2 male slots,
  // each MD match uses 4 male slots. Fill slots so each gender plays ~target matches.
  if (femaleCount >= 4) {
    womensDoubles = Math.floor(femaleCount / 2);
  }

  if (femaleCount >= 2 && maleCount >= 2) {
    mixedDoubles = Math.floor((femaleCount * targetMatchesPerPlayer - womensDoubles * 4) / 2);
    mixedDoubles = Math.max(0, mixedDoubles);
  }

  if (maleCount >= 4) {
    mensDoubles = Math.floor((maleCount * targetMatchesPerPlayer - mixedDoubles * 2) / 4);
    mensDoubles = Math.max(0, mensDoubles);
  }

  return { mensDoubles, womensDoubles, mixedDoubles, targetMatchesPerPlayer };
}

function teamUTR(team, playerLookup) {
  return team.reduce((sum, id) => sum + getUTR(playerLookup.get(id)), 0);
}

function hasUsedPartner(team, usedPartners) {
  return usedPartners.get(team[0]).has(team[1]);
}

// Given 4 players [a, b, c, d], returns the team split with the smallest
// UTR difference between teams, respecting partner uniqueness constraints.
// The 3 possible splits are: (ab vs cd), (ac vs bd), (ad vs bc).
function pickMostBalancedSplit(candidates, usedPartners, playerLookup) {
  const [a, b, c, d] = candidates;
  const splits = [
    [[a, b], [c, d]],
    [[a, c], [b, d]],
    [[a, d], [b, c]],
  ];

  let bestSplit = null;
  let bestDiff = Infinity;

  for (const [t1, t2] of splits) {
    if (hasUsedPartner(t1, usedPartners) || hasUsedPartner(t2, usedPartners)) continue;
    const diff = Math.abs(teamUTR(t1, playerLookup) - teamUTR(t2, playerLookup));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSplit = [t1, t2];
    }
  }

  return bestSplit;
}

function generateConstrainedMatchups(players, matchPlan, allowedTypes) {
  const { males, females } = classifyPlayers(players);
  const { mensDoubles, womensDoubles, mixedDoubles } = matchPlan;

  const usedPartners = new Map();
  const matchCounts = new Map();
  const matches = [];
  const playerLookup = new Map(players.map(p => [p._id, p]));

  players.forEach(p => {
    usedPartners.set(p._id, new Set());
    matchCounts.set(p._id, 0);
  });

  function recordPartnership(id1, id2) {
    usedPartners.get(id1).add(id2);
    usedPartners.get(id2).add(id1);
  }

  function incrementMatchCount(ids) {
    ids.forEach(id => matchCounts.set(id, matchCounts.get(id) + 1));
  }

  function getLowestMatchCountPlayers(pool, count) {
    return pool.slice()
      .sort((a, b) => matchCounts.get(a._id) - matchCounts.get(b._id))
      .slice(0, count);
  }

  function generateSameGenderDoubles(pool, count, matchType) {
    for (let i = 0; i < count; i++) {
      const available = pool.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      if (available.length < 4) break;

      const candidates = getLowestMatchCountPlayers(available, 4);
      const ids = candidates.map(p => p._id);
      const split = pickMostBalancedSplit(ids, usedPartners, playerLookup);
      if (!split) continue;

      const [teamA, teamB] = split;
      matches.push({ matchType, teamA, teamB });
      recordPartnership(teamA[0], teamA[1]);
      recordPartnership(teamB[0], teamB[1]);
      incrementMatchCount([...teamA, ...teamB]);
    }
  }

  if (allowedTypes.includes('mens_doubles') && males.length >= 4) {
    generateSameGenderDoubles(males, mensDoubles, 'mens_doubles');
  }

  if (allowedTypes.includes('womens_doubles') && females.length >= 4) {
    generateSameGenderDoubles(females, womensDoubles, 'womens_doubles');
  }

  if (allowedTypes.includes('mixed_doubles') && males.length >= 2 && females.length >= 2) {
    for (let i = 0; i < mixedDoubles; i++) {
      const availMales = males.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      const availFemales = females.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      if (availMales.length < 2 || availFemales.length < 2) break;

      const maleCandidates = getLowestMatchCountPlayers(availMales, 2);
      const femaleCandidates = getLowestMatchCountPlayers(availFemales, 2);

      const m1 = maleCandidates[0];
      const m2 = maleCandidates[1];
      const f1 = femaleCandidates[0];
      const f2 = femaleCandidates[1];

      // Two possible configurations: (m1+f1 vs m2+f2) or (m1+f2 vs m2+f1)
      const configs = [
        { teamA: [m1._id, f1._id], teamB: [m2._id, f2._id] },
        { teamA: [m1._id, f2._id], teamB: [m2._id, f1._id] },
      ];

      let bestConfig = null;
      let bestDiff = Infinity;
      for (const cfg of configs) {
        if (hasUsedPartner(cfg.teamA, usedPartners) || hasUsedPartner(cfg.teamB, usedPartners)) continue;
        const diff = Math.abs(teamUTR(cfg.teamA, playerLookup) - teamUTR(cfg.teamB, playerLookup));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestConfig = cfg;
        }
      }

      if (!bestConfig) continue;

      matches.push({
        matchType: 'mixed_doubles',
        teamA: bestConfig.teamA,
        teamB: bestConfig.teamB
      });
      recordPartnership(bestConfig.teamA[0], bestConfig.teamA[1]);
      recordPartnership(bestConfig.teamB[0], bestConfig.teamB[1]);
      incrementMatchCount([...bestConfig.teamA, ...bestConfig.teamB]);
    }
  }

  return { matches, matchCounts };
}

// From available players (sorted by match count ascending), find the pair
// with smallest UTR difference that hasn't already played each other.
function pickBestSinglesPair(available, usedOpponents, matchCounts, playerLookup) {
  // Sort by match count ascending so we prefer players with fewer matches
  const sorted = available.slice().sort((a, b) => {
    const countDiff = matchCounts.get(a._id) - matchCounts.get(b._id);
    if (countDiff !== 0) return countDiff;
    return 0;
  });

  let bestPair = null;
  let bestDiff = Infinity;

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      if (usedOpponents.get(a._id).has(b._id)) continue;

      const diff = Math.abs(getUTR(a) - getUTR(b));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPair = [a._id, b._id];
      }
    }
  }

  return bestPair;
}

function generateSinglesMatchups(players) {
  const matchCounts = new Map();
  const usedOpponents = new Map();
  const matches = [];
  const playerLookup = new Map(players.map(p => [p._id, p]));

  players.forEach(p => {
    matchCounts.set(p._id, 0);
    usedOpponents.set(p._id, new Set());
  });

  if (players.length < 2) {
    return { matches, matchCounts };
  }

  const target = players.length <= 6 ? 3 : 4;
  const maxRounds = Math.floor(players.length * target / 2);

  for (let round = 0; round < maxRounds; round++) {
    const available = players.filter(p => matchCounts.get(p._id) < target);
    if (available.length < 2) break;

    const pair = pickBestSinglesPair(available, usedOpponents, matchCounts, playerLookup);
    if (!pair) break;

    const [aId, bId] = pair;
    matches.push({ matchType: 'singles', teamA: [aId], teamB: [bId] });
    usedOpponents.get(aId).add(bId);
    usedOpponents.get(bId).add(aId);
    matchCounts.set(aId, matchCounts.get(aId) + 1);
    matchCounts.set(bId, matchCounts.get(bId) + 1);
  }

  return { matches, matchCounts };
}

module.exports = {
  VALID_MATCH_TYPES,
  combinations,
  ntrpToUTR,
  getUTR,
  classifyPlayers,
  planMatchDistribution,
  pickMostBalancedSplit,
  generateConstrainedMatchups,
  generateSinglesMatchups,
  pickBestSinglesPair
};
