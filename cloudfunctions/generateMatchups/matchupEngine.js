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
  const playerLookup = new Map(players.map(p => [p._id, p]));
  const playerIds = players.map(p => p._id);
  const playerIndex = new Map(playerIds.map((id, i) => [id, i]));
  const target = matchPlan.targetMatchesPerPlayer;
  const maleIds = males.map(p => p._id);
  const femaleIds = females.map(p => p._id);

  const desiredByType = {
    mens_doubles: allowedTypes.includes('mens_doubles') && maleIds.length >= 4 ? mensDoubles : 0,
    womens_doubles: allowedTypes.includes('womens_doubles') && femaleIds.length >= 4 ? womensDoubles : 0,
    mixed_doubles: allowedTypes.includes('mixed_doubles') && maleIds.length >= 2 && femaleIds.length >= 2 ? mixedDoubles : 0,
  };
  const totalDesired = desiredByType.mens_doubles + desiredByType.womens_doubles + desiredByType.mixed_doubles;

  function generateGreedy() {
    const usedPartners = new Map();
    const matchCounts = new Map();
    const matches = [];

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

    function preferMinCountGroups(groups) {
      const minCount = Math.min(...groups.flat().map(id => matchCounts.get(id)));
      const minCountIds = new Set(
        groups.flat().filter(id => matchCounts.get(id) === minCount)
      );
      const priority = groups.filter(g => g.some(id => minCountIds.has(id)));
      return priority.length > 0 ? priority : groups;
    }

    function generateSameGenderDoubles(pool, count, matchType) {
      for (let i = 0; i < count; i++) {
        const available = pool.filter(p => matchCounts.get(p._id) < target);
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

    if (desiredByType.mens_doubles > 0) {
      generateSameGenderDoubles(males, desiredByType.mens_doubles, 'mens_doubles');
    }

    if (desiredByType.womens_doubles > 0) {
      generateSameGenderDoubles(females, desiredByType.womens_doubles, 'womens_doubles');
    }

    if (desiredByType.mixed_doubles > 0) {
      for (let i = 0; i < desiredByType.mixed_doubles; i++) {
        const availMales = males.filter(p => matchCounts.get(p._id) < target);
        const availFemales = females.filter(p => matchCounts.get(p._id) < target);
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

  const greedyResult = generateGreedy();
  const shouldOptimize =
    greedyResult.matches.length < totalDesired
    && desiredByType.mixed_doubles > 0
    && (desiredByType.mens_doubles > 0 || desiredByType.womens_doubles > 0);
  if (!shouldOptimize) {
    return greedyResult;
  }

  function pairKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function makeCandidate(matchType, teamA, teamB) {
    const participants = [...teamA, ...teamB];
    const pairAKey = pairKey(teamA[0], teamA[1]);
    const pairBKey = pairKey(teamB[0], teamB[1]);
    const diff = Math.abs(teamUTR(teamA, playerLookup) - teamUTR(teamB, playerLookup));
    return {
      matchType,
      teamA,
      teamB,
      participants,
      pairAKey,
      pairBKey,
      diff,
      key: `${matchType}:${teamA.join(',')}|${teamB.join(',')}`
    };
  }

  function buildSameGenderCandidates(ids, matchType) {
    if (ids.length < 4) return [];
    const result = [];
    for (const group of combinations(ids, 4)) {
      const [a, b, c, d] = group;
      result.push(makeCandidate(matchType, [a, b], [c, d]));
      result.push(makeCandidate(matchType, [a, c], [b, d]));
      result.push(makeCandidate(matchType, [a, d], [b, c]));
    }
    return result;
  }

  function buildMixedCandidates(mIds, fIds) {
    if (mIds.length < 2 || fIds.length < 2) return [];
    const result = [];
    for (const mg of combinations(mIds, 2)) {
      for (const fg of combinations(fIds, 2)) {
        result.push(makeCandidate('mixed_doubles', [mg[0], fg[0]], [mg[1], fg[1]]));
        result.push(makeCandidate('mixed_doubles', [mg[0], fg[1]], [mg[1], fg[0]]));
      }
    }
    return result;
  }

  const candidatesByType = {
    mens_doubles: buildSameGenderCandidates(maleIds, 'mens_doubles'),
    womens_doubles: buildSameGenderCandidates(femaleIds, 'womens_doubles'),
    mixed_doubles: buildMixedCandidates(maleIds, femaleIds),
  };
  for (const type of Object.keys(candidatesByType)) {
    candidatesByType[type].sort((a, b) => a.diff - b.diff || a.key.localeCompare(b.key));
  }

  const remaining = { ...desiredByType };
  const counts = Array(players.length).fill(0);
  const usedPairs = new Set();
  const selected = [];

  const exactSearch = false;
  const maxNodes = 180000;
  const maxMs = 180;
  const candidateCap = 60;
  const startMs = Date.now();
  let nodes = 0;
  let timedOut = false;

  const best = {
    matches: [],
    counts: counts.slice(),
    totalDiff: Infinity,
    minCount: 0,
    spread: 0
  };

  function getRemainingQuotaTotal() {
    return remaining.mens_doubles + remaining.womens_doubles + remaining.mixed_doubles;
  }

  function compareScore(currentMatchCount, currentMinCount, currentSpread, currentDiff) {
    if (currentMatchCount !== best.matches.length) return currentMatchCount > best.matches.length;
    if (currentMinCount !== best.minCount) return currentMinCount > best.minCount;
    if (currentSpread !== best.spread) return currentSpread < best.spread;
    return currentDiff < best.totalDiff;
  }

  function updateBest(totalDiff) {
    const minCount = counts.length === 0 ? 0 : Math.min(...counts);
    const maxCount = counts.length === 0 ? 0 : Math.max(...counts);
    const spread = maxCount - minCount;
    if (compareScore(selected.length, minCount, spread, totalDiff)) {
      best.matches = selected.map(m => ({
        matchType: m.matchType,
        teamA: [...m.teamA],
        teamB: [...m.teamB]
      }));
      best.counts = counts.slice();
      best.totalDiff = totalDiff;
      best.minCount = minCount;
      best.spread = spread;
    }
  }

  function isFeasibleCandidate(candidate) {
    if (usedPairs.has(candidate.pairAKey) || usedPairs.has(candidate.pairBKey)) return false;
    for (const id of candidate.participants) {
      if (counts[playerIndex.get(id)] >= target) return false;
    }
    return true;
  }

  function collectFeasible(type) {
    if (remaining[type] <= 0) return [];
    const feasible = [];
    for (const candidate of candidatesByType[type]) {
      if (!isFeasibleCandidate(candidate)) continue;
      let sumCounts = 0;
      for (const id of candidate.participants) {
        sumCounts += counts[playerIndex.get(id)];
      }
      feasible.push({ candidate, sumCounts });
    }
    feasible.sort((a, b) =>
      a.sumCounts - b.sumCounts
      || a.candidate.diff - b.candidate.diff
      || a.candidate.key.localeCompare(b.candidate.key)
    );
    return feasible.map(x => x.candidate);
  }

  function applyCandidate(candidate) {
    selected.push(candidate);
    usedPairs.add(candidate.pairAKey);
    usedPairs.add(candidate.pairBKey);
    remaining[candidate.matchType] -= 1;
    for (const id of candidate.participants) {
      counts[playerIndex.get(id)] += 1;
    }
  }

  function rollbackCandidate(candidate) {
    for (const id of candidate.participants) {
      counts[playerIndex.get(id)] -= 1;
    }
    remaining[candidate.matchType] += 1;
    usedPairs.delete(candidate.pairAKey);
    usedPairs.delete(candidate.pairBKey);
    selected.pop();
  }

  function dfs(totalDiff) {
    nodes += 1;
    if (nodes > maxNodes || (Date.now() - startMs) > maxMs) {
      timedOut = true;
      return;
    }

    updateBest(totalDiff);

    const remainingQuota = getRemainingQuotaTotal();
    if (remainingQuota === 0) return;

    const remainingPlayerSlots = counts.reduce((sum, c) => sum + Math.max(0, target - c), 0);
    const upperBound = selected.length + Math.min(remainingQuota, Math.floor(remainingPlayerSlots / 4));
    if (exactSearch ? upperBound < best.matches.length : upperBound <= best.matches.length) return;

    const types = ['mixed_doubles', 'mens_doubles', 'womens_doubles'];
    let chosenType = null;
    let chosenFeasible = [];
    for (const type of types) {
      if (remaining[type] <= 0) continue;
      const feasible = collectFeasible(type);
      if (feasible.length === 0) continue;
      if (chosenType == null || feasible.length < chosenFeasible.length) {
        chosenType = type;
        chosenFeasible = feasible;
      }
    }
    if (!chosenType) return;

    const limit = Math.min(chosenFeasible.length, candidateCap);
    for (let i = 0; i < limit; i++) {
      const candidate = chosenFeasible[i];
      applyCandidate(candidate);
      dfs(totalDiff + candidate.diff);
      rollbackCandidate(candidate);
      if (timedOut && !exactSearch) break;
    }

    // Option to skip one planned slot of this type when it blocks better overall outcomes.
    remaining[chosenType] -= 1;
    dfs(totalDiff);
    remaining[chosenType] += 1;
  }

  dfs(0);

  const optimized = {
    matches: best.matches,
    matchCounts: new Map(players.map((p, idx) => [p._id, best.counts[idx] || 0]))
  };

  // Only replace greedy output when optimization improves total matches.
  if (optimized.matches.length > greedyResult.matches.length) {
    return optimized;
  }
  return greedyResult;
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

function buildMatchupKey(teamA, teamB) {
  const sortedA = [...teamA].sort().join('+');
  const sortedB = [...teamB].sort().join('+');
  return [sortedA, sortedB].sort().join('-vs-');
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
  scheduleMatches,
  buildMatchupKey
};
