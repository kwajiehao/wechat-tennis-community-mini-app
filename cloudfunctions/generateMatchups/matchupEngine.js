// ABOUTME: Pure matchup generation algorithm — distribution planning, team formation, and pairing.
// ABOUTME: Decoupled from WeChat cloud SDK for testability.

const VALID_MATCH_TYPES = [
  'mens_singles',
  'womens_singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles'
];

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

function formBalancedTeam(pool, usedPartners, playerId) {
  const sorted = pool.slice().sort((a, b) => getUTR(b) - getUTR(a));
  const midpoint = Math.floor(sorted.length / 2);

  const playerPartners = usedPartners.get(playerId) || new Set();
  const isStrong = sorted.findIndex(p => p._id === playerId) < midpoint;

  const searchPool = isStrong ? sorted.slice(midpoint) : sorted.slice(0, midpoint);

  for (const candidate of searchPool) {
    if (candidate._id !== playerId && !playerPartners.has(candidate._id)) {
      return candidate._id;
    }
  }

  for (const candidate of sorted) {
    if (candidate._id !== playerId && !playerPartners.has(candidate._id)) {
      return candidate._id;
    }
  }

  return null;
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

  function teamUTR(team) {
    return team.reduce((sum, id) => sum + getUTR(playerLookup.get(id)), 0);
  }

  function hasUsedPartner(team) {
    return usedPartners.get(team[0]).has(team[1]);
  }

  let bestSplit = null;
  let bestDiff = Infinity;

  for (const [t1, t2] of splits) {
    if (hasUsedPartner(t1) || hasUsedPartner(t2)) continue;
    const diff = Math.abs(teamUTR(t1) - teamUTR(t2));
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

      function teamUTR(team) {
        return team.reduce((sum, id) => sum + getUTR(playerLookup.get(id)), 0);
      }

      function hasUsedPartner(team) {
        return usedPartners.get(team[0]).has(team[1]);
      }

      let bestConfig = null;
      let bestDiff = Infinity;
      for (const cfg of configs) {
        if (hasUsedPartner(cfg.teamA) || hasUsedPartner(cfg.teamB)) continue;
        const diff = Math.abs(teamUTR(cfg.teamA) - teamUTR(cfg.teamB));
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

module.exports = {
  VALID_MATCH_TYPES,
  ntrpToUTR,
  getUTR,
  classifyPlayers,
  planMatchDistribution,
  formBalancedTeam,
  generateConstrainedMatchups
};
