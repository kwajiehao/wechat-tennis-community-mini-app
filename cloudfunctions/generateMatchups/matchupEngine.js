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

  function getEligiblePool(pool) {
    const minCount = Math.min(...pool.map(p => matchCounts.get(p._id)));
    return pool.filter(p => matchCounts.get(p._id) <= minCount + 1);
  }

  // Filter combo groups to prefer those including minimum-count players
  function preferMinCountGroups(groups, minSize) {
    const minCount = Math.min(...groups.flat().map(id => matchCounts.get(id)));
    const minCountIds = new Set(
      groups.flat().filter(id => matchCounts.get(id) === minCount)
    );
    const priority = groups.filter(g => g.some(id => minCountIds.has(id)));
    return priority.length > 0 ? priority : groups;
  }

  function generateSameGenderDoubles(pool, count, matchType) {
    for (let i = 0; i < count; i++) {
      const available = pool.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
      if (available.length < 4) break;

      const eligible = getEligiblePool(available);
      const candidates = eligible.length >= 4 ? eligible : available;
      const allGroups = combinations(candidates.map(p => p._id), 4);
      const groups = preferMinCountGroups(allGroups);

      let bestSplit = null;
      let bestDiff = Infinity;
      for (const group of groups) {
        const split = pickMostBalancedSplit(group, usedPartners, playerLookup);
        if (!split) continue;
        const diff = Math.abs(teamUTR(split[0], playerLookup) - teamUTR(split[1], playerLookup));
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSplit = split;
        }
      }
      if (!bestSplit) continue;

      const [teamA, teamB] = bestSplit;
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

      const eligibleMales = getEligiblePool(availMales);
      const eligibleFemales = getEligiblePool(availFemales);
      const malePool = eligibleMales.length >= 2 ? eligibleMales : availMales;
      const femalePool = eligibleFemales.length >= 2 ? eligibleFemales : availFemales;
      const maleGroups = preferMinCountGroups(combinations(malePool.map(p => p._id), 2));
      const femaleGroups = preferMinCountGroups(combinations(femalePool.map(p => p._id), 2));

      let bestConfig = null;
      let bestDiff = Infinity;
      for (const mg of maleGroups) {
        for (const fg of femaleGroups) {
          const configs = [
            { teamA: [mg[0], fg[0]], teamB: [mg[1], fg[1]] },
            { teamA: [mg[0], fg[1]], teamB: [mg[1], fg[0]] },
          ];
          for (const cfg of configs) {
            if (hasUsedPartner(cfg.teamA, usedPartners) || hasUsedPartner(cfg.teamB, usedPartners)) continue;
            const diff = Math.abs(teamUTR(cfg.teamA, playerLookup) - teamUTR(cfg.teamB, playerLookup));
            if (diff < bestDiff) {
              bestDiff = diff;
              bestConfig = cfg;
            }
          }
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

// From eligible pool (players with count ≤ min + 1), find the pair
// with smallest UTR difference that hasn't already played each other.
function pickBestSinglesPair(available, usedOpponents, matchCounts, playerLookup) {
  const minCount = Math.min(...available.map(p => matchCounts.get(p._id)));
  const eligible = available.filter(p => matchCounts.get(p._id) <= minCount + 1);
  const pool = eligible.length >= 2 ? eligible : available;

  // Prefer pairs including minimum-count players
  const minCountIds = new Set(pool.filter(p => matchCounts.get(p._id) === minCount).map(p => p._id));

  let bestPair = null;
  let bestDiff = Infinity;
  let bestHasMin = false;

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];

      if (usedOpponents.get(a._id).has(b._id)) continue;

      const hasMin = minCountIds.has(a._id) || minCountIds.has(b._id);
      const diff = Math.abs(getUTR(a) - getUTR(b));

      // Prefer pairs with min-count players; among those, smallest UTR diff
      if ((hasMin && !bestHasMin) || (hasMin === bestHasMin && diff < bestDiff)) {
        bestDiff = diff;
        bestPair = [a._id, b._id];
        bestHasMin = hasMin;
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

// Reorders matches so play time is spread evenly across participants.
// Assigns matchNumber (1-indexed) to each match.
function scheduleMatches(matches) {
  if (matches.length === 0) return [];

  const unscheduled = matches.map((m, i) => i);
  const scheduled = [];
  const lastPlaySlot = new Map();

  // Collect all participants
  for (const match of matches) {
    for (const id of match.participants || [...match.teamA, ...match.teamB]) {
      if (!lastPlaySlot.has(id)) lastPlaySlot.set(id, -2);
    }
  }

  for (let slot = 0; slot < matches.length; slot++) {
    let bestIdx = -1;
    let bestMinGap = -1;
    let bestTotalGap = -1;

    for (const idx of unscheduled) {
      const participants = matches[idx].participants || [...matches[idx].teamA, ...matches[idx].teamB];

      // Minimum rest gap across all participants in this match
      let minGap = Infinity;
      let totalGap = 0;
      for (const id of participants) {
        const gap = slot - lastPlaySlot.get(id);
        if (gap < minGap) minGap = gap;
        totalGap += gap;
      }

      // Pick match with largest minimum gap; break ties by largest total gap
      if (minGap > bestMinGap || (minGap === bestMinGap && totalGap > bestTotalGap)) {
        bestMinGap = minGap;
        bestTotalGap = totalGap;
        bestIdx = idx;
      }
    }

    const participants = matches[bestIdx].participants || [...matches[bestIdx].teamA, ...matches[bestIdx].teamB];
    for (const id of participants) {
      lastPlaySlot.set(id, slot);
    }

    scheduled.push({ ...matches[bestIdx], matchNumber: slot + 1 });
    unscheduled.splice(unscheduled.indexOf(bestIdx), 1);
  }

  return scheduled;
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
  pickBestSinglesPair,
  scheduleMatches
};
