// ABOUTME: Mock implementations of cloud functions for local development mode.
// ABOUTME: Provides identical API to cloud functions using in-memory storage.

const { store, DEV_USER_OPENID, generateId } = require('./local-store');

const VALID_MATCH_TYPES = [
  'mens_singles',
  'womens_singles',
  'mens_doubles',
  'womens_doubles',
  'mixed_doubles'
];

function getWXContext() {
  return { OPENID: DEV_USER_OPENID };
}

async function getSettings() {
  const res = await store.collection('settings').doc('core').get().catch(() => null);
  return res && res.data ? res.data : null;
}

async function ensureSettings(openid) {
  const DEFAULT_SETTINGS = {
    adminOpenIds: [],
    pointsConfig: { win: 3, loss: 1 },
    ntrpScaleConfig: {},
    activeSeasonId: null
  };
  let existing;
  try {
    const res = await store.collection('settings').doc('core').get();
    existing = res.data;
  } catch (e) {
    existing = null;
  }
  if (!existing) {
    const data = { ...DEFAULT_SETTINGS, adminOpenIds: [openid] };
    await store.collection('settings').doc('core').set({ data });
    return data;
  }
  const merged = { ...DEFAULT_SETTINGS, ...existing };
  if ((!merged.adminOpenIds || merged.adminOpenIds.length === 0) && openid) {
    merged.adminOpenIds = [openid];
  }
  await store.collection('settings').doc('core').set({ data: merged });
  return merged;
}

async function assertAdmin(openid) {
  const settings = await ensureSettings(openid);
  if (!settings.adminOpenIds.includes(openid)) {
    throw new Error('PERMISSION_DENIED');
  }
  return settings;
}

async function getPlayerByOpenId(openid) {
  const res = await store.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

function ntrpToUTR(ntrp) {
  return 1.0 + ((ntrp || 3.0) - 1.0) * 2.5;
}

function getUTR(player) {
  if (player.utr != null) return player.utr;
  return ntrpToUTR(player.ntrp);
}

function calculateMatchRating(opponentUTR, gamesWon, gamesLost, didWin) {
  const totalGames = gamesWon + gamesLost;
  if (totalGames === 0) {
    return opponentUTR + (didWin ? 0.5 : -0.5);
  }
  const gamePercentage = gamesWon / totalGames;
  const adjustment = (gamePercentage - 0.5) * 3.0;
  return opponentUTR + adjustment;
}

function extractGamesFromSets(sets, isTeamA) {
  if (!sets || sets.length === 0) return { won: 0, lost: 0 };
  let won = 0, lost = 0;
  for (const set of sets) {
    const teamAGames = set.teamAGames || 0;
    const teamBGames = set.teamBGames || 0;
    if (isTeamA) {
      won += teamAGames;
      lost += teamBGames;
    } else {
      won += teamBGames;
      lost += teamAGames;
    }
  }
  return { won, lost };
}

async function recalculatePlayerUTR(playerId, playerNtrp) {
  // Fetch completed matches for this player
  const allMatches = await store.collection('matches').get();
  const matches = (allMatches.data || [])
    .filter(m => m.status === 'completed' && (m.participants || []).includes(playerId))
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
    .slice(0, 30);

  if (matches.length === 0) return null;

  const PROVISIONAL_THRESHOLD = 5;

  const resultsRes = await store.collection('results').get();
  const resultMap = new Map((resultsRes.data || []).map(r => [r.matchId, r]));

  const opponentIds = new Set();
  matches.forEach(m => {
    (m.teamA || []).forEach(id => { if (id !== playerId) opponentIds.add(id); });
    (m.teamB || []).forEach(id => { if (id !== playerId) opponentIds.add(id); });
  });

  const playersRes = await store.collection('players').get();
  const opponentMap = new Map(
    (playersRes.data || []).filter(p => opponentIds.has(p._id)).map(p => [p._id, p])
  );

  let weightedSum = 0;
  let totalWeight = 0;
  const now = Date.now();

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const result = resultMap.get(match._id);
    if (!result) continue;

    const isTeamA = (match.teamA || []).includes(playerId);
    const didWin = (result.winnerPlayers || []).includes(playerId);

    const opponentTeam = isTeamA ? match.teamB : match.teamA;
    let opponentUTR = 0;
    for (const oppId of opponentTeam) {
      const opp = opponentMap.get(oppId);
      opponentUTR += opp ? getUTR(opp) : 5.0;
    }
    opponentUTR = opponentUTR / opponentTeam.length;

    const games = extractGamesFromSets(result.sets, isTeamA);
    const matchRating = calculateMatchRating(opponentUTR, games.won, games.lost, didWin);

    const matchDate = new Date(match.completedAt || match.generatedAt).getTime();
    const daysAgo = (now - matchDate) / (1000 * 60 * 60 * 24);
    const timeDecay = Math.exp(-daysAgo / 180);
    const positionWeight = (matches.length - i) / matches.length;
    const weight = timeDecay * positionWeight;

    weightedSum += matchRating * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  const calculatedUTR = weightedSum / totalWeight;

  // Provisional period: blend NTRP-based UTR with calculated UTR
  let finalUTR;
  if (matches.length >= PROVISIONAL_THRESHOLD) {
    finalUTR = calculatedUTR;
  } else {
    const ntrpBasedUTR = ntrpToUTR(playerNtrp);
    const calculatedWeight = matches.length / PROVISIONAL_THRESHOLD;
    const ntrpWeight = 1 - calculatedWeight;
    finalUTR = (ntrpBasedUTR * ntrpWeight) + (calculatedUTR * calculatedWeight);
  }

  const clampedUTR = Math.max(1.0, Math.min(16.5, finalUTR));
  return Math.round(clampedUTR * 100) / 100;
}

async function updatePlayerStrength(match, winnerSide, sets) {
  const allIds = [...(match.teamA || []), ...(match.teamB || [])];

  const playersRes = await store.collection('players').get();
  const players = (playersRes.data || []).filter(p => allIds.includes(p._id));

  const now = new Date().toISOString();

  for (const player of players) {
    if (player.utr == null) {
      const initialUTR = ntrpToUTR(player.ntrp);
      await store.collection('players').doc(player._id).update({
        data: { utr: initialUTR, utrUpdatedAt: now }
      });
    }
  }

  const playerMap = new Map(players.map(p => [p._id, p]));
  for (const playerId of allIds) {
    const player = playerMap.get(playerId);
    const playerNtrp = player ? player.ntrp : 3.0;
    const newUTR = await recalculatePlayerUTR(playerId, playerNtrp);
    if (newUTR !== null) {
      await store.collection('players').doc(playerId).update({
        data: { utr: newUTR, utrUpdatedAt: now }
      });
    }
  }
}

const handlers = {
  async checkAdmin(event) {
    const { OPENID } = getWXContext();
    const settings = await getSettings();
    if (!settings || !settings.adminOpenIds) {
      return { isAdmin: false };
    }
    return { isAdmin: settings.adminOpenIds.includes(OPENID) };
  },

  async getPlayer(event) {
    const { OPENID } = getWXContext();
    const { playerId } = event;
    if (playerId) {
      const res = await store.collection('players').doc(playerId).get();
      return { player: res.data };
    }
    const player = await getPlayerByOpenId(OPENID);
    return { player };
  },

  async listPlayers(event) {
    const { OPENID } = getWXContext();
    const { mine } = event;

    if (mine) {
      const res = await store.collection('players').where({ wechatOpenId: OPENID }).get();
      return { players: res.data || [] };
    }

    const settings = await ensureSettings(OPENID);
    const isAdmin = settings.adminOpenIds.includes(OPENID);

    const res = await store.collection('players').get();
    const players = res.data || [];

    if (isAdmin) {
      return { players };
    }

    // Non-admins get player list without sensitive fields
    return {
      players: players.map(p => ({
        _id: p._id,
        playerId: p.playerId,
        name: p.name,
        ntrp: p.ntrp,
        gender: p.gender,
        isTestPlayer: p.isTestPlayer,
        isActive: p.isActive
      }))
    };
  },

  async upsertPlayer(event) {
    const { OPENID } = getWXContext();
    const { playerId, createNew, name, ntrp, isActive, notes } = event;
    // Normalize gender to uppercase for consistent storage
    const gender = (event.gender || '').toUpperCase();
    const now = new Date().toISOString();

    // Admin creating a test player (no OPENID link)
    if (createNew) {
      await assertAdmin(OPENID);
      const res = await store.collection('players').add({
        data: {
          wechatOpenId: null,
          isTestPlayer: true,
          name,
          gender,
          ntrp,
          isActive: isActive !== false,
          notes: notes || '',
          createdAt: now,
          updatedAt: now
        }
      });
      await store.collection('players').doc(res._id).update({
        data: { playerId: res._id }
      });
      return { playerId: res._id };
    }

    // Admin updating an existing player by ID
    if (playerId) {
      await assertAdmin(OPENID);
      await store.collection('players').doc(playerId).update({
        data: { name, gender, ntrp, isActive, notes, updatedAt: now }
      });
      return { playerId };
    }

    // User self-registration: create or update their own profile
    const existing = await getPlayerByOpenId(OPENID);
    if (existing) {
      await store.collection('players').doc(existing._id).update({
        data: { name, gender, ntrp, isActive, notes, updatedAt: now }
      });
      return { playerId: existing._id };
    }

    const res = await store.collection('players').add({
      data: {
        wechatOpenId: OPENID,
        name,
        gender,
        ntrp,
        isActive: isActive !== false,
        notes: notes || '',
        createdAt: now,
        updatedAt: now
      }
    });
    await store.collection('players').doc(res._id).update({
      data: { playerId: res._id }
    });
    return { playerId: res._id };
  },

  async createEvent(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { title, date, location, startTime = '', endTime = '', matchTypesAllowed = VALID_MATCH_TYPES, seasonId } = event;

    if (!title || !date) {
      throw new Error('MISSING_FIELDS');
    }

    const existing = await store.collection('events').where({ title }).get();
    if (existing.data.length > 0) {
      throw new Error('DUPLICATE_EVENT_TITLE');
    }

    const validatedMatchTypes = matchTypesAllowed.filter(t => VALID_MATCH_TYPES.includes(t));
    if (validatedMatchTypes.length === 0) {
      throw new Error('INVALID_MATCH_TYPES');
    }

    const settings = await getSettings();
    const finalSeasonId = seasonId || (settings ? settings.activeSeasonId : null);
    const now = new Date().toISOString();

    const res = await store.collection('events').add({
      data: {
        title,
        date,
        location: location || '',
        startTime,
        endTime,
        matchTypesAllowed: validatedMatchTypes,
        status: 'open',
        waitlist: [],
        createdBy: OPENID,
        createdAt: now,
        updatedAt: now,
        seasonId: finalSeasonId
      }
    });

    await store.collection('events').doc(res._id).update({
      data: { eventId: res._id }
    });

    return { eventId: res._id };
  },

  async listEvents(event) {
    const { eventId } = event;
    if (eventId) {
      try {
        const res = await store.collection('events').doc(eventId).get();
        return { events: [res.data] };
      } catch (e) {
        return { events: [] };
      }
    }
    const res = await store.collection('events').get();
    return { events: res.data || [] };
  },

  async updateEvent(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId, ...updates } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');
    updates.updatedAt = new Date().toISOString();
    await store.collection('events').doc(eventId).update({ data: updates });
    return { updated: true };
  },

  async signupEvent(event) {
    const { OPENID } = getWXContext();
    const { eventId, playerId: targetPlayerId, availabilitySlots = [], preferredMatchTypes = [] } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    let player;
    if (targetPlayerId) {
      const settings = await ensureSettings(OPENID);
      if (!settings.adminOpenIds.includes(OPENID)) {
        throw new Error('PERMISSION_DENIED');
      }
      try {
        const playerRes = await store.collection('players').doc(targetPlayerId).get();
        player = playerRes.data;
      } catch (e) {
        player = null;
      }
      if (!player) throw new Error('PLAYER_NOT_FOUND');
    } else {
      player = await getPlayerByOpenId(OPENID);
      if (!player) throw new Error('PLAYER_NOT_FOUND');
    }

    if (!player.name || !player.gender || player.ntrp === null || player.ntrp === undefined) {
      throw new Error('PROFILE_INCOMPLETE');
    }

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');

    const existing = await store.collection('signups')
      .where({ playerId: player._id, eventId })
      .get();

    // Check signup limit (only for new signups, not updates)
    if (existing.data.length === 0) {
      const signupCount = await store.collection('signups')
        .where({ eventId, status: 'signed' })
        .get();
      const maxPlayers = eventData.maxPlayers || 9;
      if ((signupCount.data || []).length >= maxPlayers) {
        throw new Error('EVENT_FULL');
      }

      // Gender restriction: limit 5 men for self-signups (admin can bypass)
      if (!targetPlayerId && (player.gender || '').toUpperCase() === 'M') {
        const allSignups = await store.collection('signups')
          .where({ eventId, status: 'signed' })
          .get();
        const signedPlayerIds = (allSignups.data || []).map(s => s.playerId);
        if (signedPlayerIds.length > 0) {
          const playersRes = await store.collection('players').get();
          const signedPlayers = (playersRes.data || []).filter(p => signedPlayerIds.includes(p._id));
          const maleCount = signedPlayers.filter(p =>
            (p.gender || '').toUpperCase() === 'M'
          ).length;
          if (maleCount >= 5) {
            throw new Error('MALE_LIMIT_REACHED');
          }
        }
      }
    }

    const now = new Date().toISOString();
    if (existing.data.length > 0) {
      await store.collection('signups').doc(existing.data[0]._id).update({
        data: {
          availabilitySlots,
          preferredMatchTypes,
          status: 'signed',
          createdAt: now,
          updatedAt: now
        }
      });
      return { signupId: existing.data[0]._id };
    }

    const res = await store.collection('signups').add({
      data: {
        playerId: player._id,
        eventId,
        seasonId: eventData.seasonId || null,
        availabilitySlots,
        preferredMatchTypes,
        status: 'signed',
        createdAt: now,
        updatedAt: now
      }
    });
    return { signupId: res._id };
  },

  async withdrawEvent(event) {
    const { OPENID } = getWXContext();
    const { eventId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    // Check event status - cannot withdraw once in_progress or completed
    const eventDoc = await store.collection('events').doc(eventId).get();
    if (!eventDoc.data) throw new Error('EVENT_NOT_FOUND');
    const eventStatus = eventDoc.data.status;
    if (eventStatus === 'in_progress' || eventStatus === 'completed') {
      throw new Error('EVENT_NOT_OPEN');
    }

    const player = await getPlayerByOpenId(OPENID);
    if (!player) throw new Error('PLAYER_NOT_FOUND');

    const existing = await store.collection('signups')
      .where({ playerId: player._id, eventId })
      .get();

    if (existing.data.length === 0) {
      throw new Error('NOT_SIGNED_UP');
    }

    await store.collection('signups').doc(existing.data[0]._id).update({
      data: {
        status: 'withdrawn',
        updatedAt: new Date().toISOString()
      }
    });

    return { success: true };
  },

  async listSignups(event) {
    const { OPENID } = getWXContext();
    const { eventId, mine, includeNames } = event;

    if (mine) {
      const player = await getPlayerByOpenId(OPENID);
      if (!player) return { signups: [] };
      const query = eventId ? { playerId: player._id, eventId } : { playerId: player._id };
      const res = await store.collection('signups').where(query).get();
      return { signups: res.data || [] };
    }

    if (eventId) {
      const res = await store.collection('signups')
        .where({ eventId, status: 'signed' })
        .get();
      let signups = res.data || [];

      if (includeNames) {
        const playerIds = signups.map(s => s.playerId);
        const playersRes = await store.collection('players').get();
        const players = playersRes.data.filter(p => playerIds.includes(p._id));
        const playerMap = new Map(players.map(p => [p._id, p]));
        signups = signups.map(s => {
          const player = playerMap.get(s.playerId) || {};
          return {
            ...s,
            playerName: player.name || 'Unknown',
            playerNtrp: player.ntrp || null,
            playerGender: (player.gender || '').toUpperCase() || null,
            isTestPlayer: player.isTestPlayer || false
          };
        });
      }
      return { signups };
    }

    await assertAdmin(OPENID);
    const res = await store.collection('signups').get();
    return { signups: res.data || [] };
  },

  async generateMatchups(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');

    if (eventData.status === 'completed' || eventData.status === 'match_started') {
      throw new Error('CANNOT_REGENERATE');
    }

    // Remove all non-completed matches (allows regeneration)
    const existingMatches = await store.collection('matches').where({ eventId }).get();
    for (const m of existingMatches.data || []) {
      if (m.status !== 'completed') {
        await store.collection('matches').doc(m._id).remove();
      }
    }

    const signupsRes = await store.collection('signups').where({ eventId, status: 'signed' }).get();
    const signups = signupsRes.data || [];
    const playerIds = signups.map(s => s.playerId);

    if (playerIds.length === 0) {
      return { matches: [], waitlist: [] };
    }

    const playersRes = await store.collection('players').get();
    const players = playersRes.data.filter(p => playerIds.includes(p._id));
    const playerMap = new Map(players.map(p => [p._id, p]));

    const roster = signups
      .map(s => ({ player: playerMap.get(s.playerId), signup: s }))
      .filter(r => r.player && r.player.isActive !== false);

    const activePlayers = roster.map(r => r.player);
    const seasonId = eventData.seasonId;

    function classifyPlayers(playerList) {
      const males = playerList.filter(p => (p.gender || '').toUpperCase() === 'M')
        .sort((a, b) => getUTR(b) - getUTR(a));
      const females = playerList.filter(p => (p.gender || '').toUpperCase() === 'F')
        .sort((a, b) => getUTR(b) - getUTR(a));
      return { males, females };
    }

    function planMatchDistribution(maleCount, femaleCount) {
      const totalPlayers = maleCount + femaleCount;
      const targetMatchesPerPlayer = totalPlayers <= 6 ? 3 : 4;
      const totalPlayerSlots = totalPlayers * targetMatchesPerPlayer;
      const totalMatches = Math.floor(totalPlayerSlots / 4);

      let mensDoubles = 0, womensDoubles = 0, mixedDoubles = 0;

      if (femaleCount >= 4) {
        womensDoubles = Math.min(Math.floor(femaleCount / 2), Math.floor(totalMatches / 3));
      }
      if (maleCount >= 4) {
        mensDoubles = Math.min(Math.floor(maleCount / 2), Math.floor(totalMatches / 3));
      }

      const pairCount = Math.min(maleCount, femaleCount);
      if (pairCount >= 2) {
        mixedDoubles = Math.max(1, totalMatches - mensDoubles - womensDoubles);
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

    function generateConstrainedMatchups(playerList, matchPlan, allowedTypes) {
      const { males, females } = classifyPlayers(playerList);
      const { mensDoubles, womensDoubles, mixedDoubles } = matchPlan;

      const usedPartners = new Map();
      const matchCounts = new Map();
      const matches = [];

      playerList.forEach(p => {
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

      if (allowedTypes.includes('mens_doubles') && males.length >= 4) {
        for (let i = 0; i < mensDoubles; i++) {
          const available = males.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
          if (available.length < 4) break;

          const candidates = getLowestMatchCountPlayers(available, 4);
          const p1 = candidates[0];
          const p2Id = formBalancedTeam(candidates, usedPartners, p1._id);
          if (!p2Id) continue;

          const remaining = candidates.filter(p => p._id !== p1._id && p._id !== p2Id);
          if (remaining.length < 2) continue;

          const p3 = remaining[0];
          const p4Id = formBalancedTeam(remaining, usedPartners, p3._id);
          if (!p4Id) continue;

          matches.push({
            matchType: 'mens_doubles',
            teamA: [p1._id, p2Id],
            teamB: [p3._id, p4Id]
          });
          recordPartnership(p1._id, p2Id);
          recordPartnership(p3._id, p4Id);
          incrementMatchCount([p1._id, p2Id, p3._id, p4Id]);
        }
      }

      if (allowedTypes.includes('womens_doubles') && females.length >= 4) {
        for (let i = 0; i < womensDoubles; i++) {
          const available = females.filter(p => matchCounts.get(p._id) < matchPlan.targetMatchesPerPlayer);
          if (available.length < 4) break;

          const candidates = getLowestMatchCountPlayers(available, 4);
          const p1 = candidates[0];
          const p2Id = formBalancedTeam(candidates, usedPartners, p1._id);
          if (!p2Id) continue;

          const remaining = candidates.filter(p => p._id !== p1._id && p._id !== p2Id);
          if (remaining.length < 2) continue;

          const p3 = remaining[0];
          const p4Id = formBalancedTeam(remaining, usedPartners, p3._id);
          if (!p4Id) continue;

          matches.push({
            matchType: 'womens_doubles',
            teamA: [p1._id, p2Id],
            teamB: [p3._id, p4Id]
          });
          recordPartnership(p1._id, p2Id);
          recordPartnership(p3._id, p4Id);
          incrementMatchCount([p1._id, p2Id, p3._id, p4Id]);
        }
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

          const m1Partners = usedPartners.get(m1._id);
          const m2Partners = usedPartners.get(m2._id);

          let teamA, teamB;
          if (!m1Partners.has(f1._id) && !m2Partners.has(f2._id)) {
            teamA = [m1._id, f1._id];
            teamB = [m2._id, f2._id];
          } else if (!m1Partners.has(f2._id) && !m2Partners.has(f1._id)) {
            teamA = [m1._id, f2._id];
            teamB = [m2._id, f1._id];
          } else {
            continue;
          }

          matches.push({
            matchType: 'mixed_doubles',
            teamA,
            teamB
          });
          recordPartnership(teamA[0], teamA[1]);
          recordPartnership(teamB[0], teamB[1]);
          incrementMatchCount([...teamA, ...teamB]);
        }
      }

      return { matches, matchCounts };
    }

    const { males, females } = classifyPlayers(activePlayers);
    const allMatchTypes = eventData.matchTypesAllowed || VALID_MATCH_TYPES;
    const doublesTypes = allMatchTypes.filter(t => t.includes('doubles'));
    const matchPlan = planMatchDistribution(males.length, females.length);

    const { matches, matchCounts } = generateConstrainedMatchups(activePlayers, matchPlan, doublesTypes);

    const now = new Date().toISOString();
    const matchesToCreate = matches.map(match => ({
      eventId,
      seasonId,
      matchType: match.matchType,
      teamA: match.teamA,
      teamB: match.teamB,
      participants: match.teamA.concat(match.teamB),
      status: 'approved',
      generatedAt: now,
      approvedBy: null
    }));

    const waitlist = activePlayers
      .filter(p => matchCounts.get(p._id) === 0)
      .map(p => p._id);

    for (const match of matchesToCreate) {
      await store.collection('matches').add({ data: match });
    }

    await store.collection('events').doc(eventId).update({
      data: { waitlist, status: 'in_progress', updatedAt: now }
    });

    return { matchCount: matchesToCreate.length, waitlist };
  },

  async approveMatchups(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    // This function is deprecated - matches are now auto-approved when generated.
    // Kept for backwards compatibility but does nothing.
    return { eventId, deprecated: true };
  },

  async completeEvent(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');
    if (eventData.status !== 'in_progress' && eventData.status !== 'match_started') {
      throw new Error('EVENT_NOT_IN_PROGRESS');
    }
    const previousStatus = eventData.status;

    const now = new Date().toISOString();
    await store.collection('events').doc(eventId).update({
      data: {
        status: 'completed',
        previousStatus,
        completedAt: now
      }
    });

    return { eventId };
  },

  async reopenEvent(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');
    if (eventData.status !== 'completed') throw new Error('EVENT_NOT_COMPLETED');

    // Block reopening if score has been computed (event is locked)
    if (eventData.leaderboard && eventData.leaderboard.computed) {
      throw new Error('EVENT_LOCKED');
    }

    // Restore to previous status (in_progress or match_started)
    const restoreStatus = eventData.previousStatus || 'in_progress';

    await store.collection('events').doc(eventId).update({
      data: {
        status: restoreStatus,
        playerPoints: null,
        completedAt: null,
        previousStatus: null
      }
    });

    return { eventId };
  },

  // Leaderboard calculation rules:
  // 1. Count wins per player (doubles matches count as 1 win for each player on winning team)
  // 2. Calculate game difference: sum of (gamesWon - gamesLost) across all matches
  // 3. Sort by: wins DESC, then game difference DESC
  // 4. If tied on both wins AND game difference, admin must pick champion
  // 5. Bonuses: 1st place gets +4 points, 2nd place gets +2 points
  // 6. Total points = wins + bonus
  async computeEventScore(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);

    const { eventId, championId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');

    if (eventData.status !== 'completed') {
      throw new Error('EVENT_NOT_COMPLETED');
    }

    if (eventData.leaderboard && eventData.leaderboard.computed) {
      throw new Error('SCORE_ALREADY_COMPUTED');
    }

    // Fetch all completed matches for this event
    const matchesRes = await store.collection('matches').where({ eventId, status: 'completed' }).get();
    const matches = matchesRes.data || [];

    // Fetch results for those matches
    const resultsRes = await store.collection('results').get();
    const results = resultsRes.data || [];
    const resultMap = new Map(results.map(r => [r.matchId, r]));

    // Calculate player stats: wins and game difference
    const playerStats = {};
    for (const match of matches) {
      const result = resultMap.get(match._id);
      if (!result) continue;

      const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];

      // Initialize players if not seen
      for (const pid of allPlayers) {
        if (!playerStats[pid]) {
          playerStats[pid] = { wins: 0, gamesWon: 0, gamesLost: 0 };
        }
      }

      // Count wins (1 per winning player per match)
      const winnerPlayers = result.winnerPlayers || [];
      for (const pid of winnerPlayers) {
        playerStats[pid].wins += 1;
      }

      // Calculate games from sets for game difference
      const sets = result.sets || [];
      for (const set of sets) {
        const teamAGames = parseInt(set.teamAGames) || 0;
        const teamBGames = parseInt(set.teamBGames) || 0;

        for (const pid of (match.teamA || [])) {
          playerStats[pid].gamesWon += teamAGames;
          playerStats[pid].gamesLost += teamBGames;
        }
        for (const pid of (match.teamB || [])) {
          playerStats[pid].gamesWon += teamBGames;
          playerStats[pid].gamesLost += teamAGames;
        }
      }
    }

    // Build rankings array
    const rankings = Object.entries(playerStats).map(([playerId, stats]) => ({
      playerId,
      wins: stats.wins,
      gameDifference: stats.gamesWon - stats.gamesLost,
      bonus: 0,
      totalPoints: stats.wins,
      rank: 0,
      remarks: null
    }));

    // Sort by wins DESC, then game difference DESC
    rankings.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.gameDifference - a.gameDifference;
    });

    // Check for ties at top positions
    const hasTieForFirst = rankings.length >= 2 &&
      rankings[0].wins === rankings[1].wins &&
      rankings[0].gameDifference === rankings[1].gameDifference;

    // If tie exists and no champion selected, return tie info for admin to resolve
    if (hasTieForFirst && !championId) {
      const tiedPlayers = rankings.filter(r =>
        r.wins === rankings[0].wins &&
        r.gameDifference === rankings[0].gameDifference
      );

      // Fetch player names for tied players
      const tiedIds = tiedPlayers.map(p => p.playerId);
      const playersRes = await store.collection('players').get();
      const playerNameMap = new Map((playersRes.data || []).map(p => [p._id, p.name]));

      for (const r of tiedPlayers) {
        r.playerName = playerNameMap.get(r.playerId) || 'Unknown';
      }

      return {
        requiresTieBreak: true,
        tiedPlayerIds: tiedIds,
        rankings: tiedPlayers
      };
    }

    // Apply tie-break if champion was selected
    let tieResolution = null;
    if (hasTieForFirst && championId) {
      const tiedIds = rankings.filter(r =>
        r.wins === rankings[0].wins &&
        r.gameDifference === rankings[0].gameDifference
      ).map(p => p.playerId);

      if (!tiedIds.includes(championId)) {
        throw new Error('INVALID_CHAMPION');
      }

      // Move champion to index 0
      const championIndex = rankings.findIndex(r => r.playerId === championId);
      const [champion] = rankings.splice(championIndex, 1);
      rankings.unshift(champion);

      tieResolution = {
        tiedPlayerIds: tiedIds,
        championId
      };
    }

    // Assign ranks and bonuses
    for (let i = 0; i < rankings.length; i++) {
      rankings[i].rank = i + 1;
      if (i === 0) {
        rankings[i].bonus = 4;
        rankings[i].remarks = '1st';
      } else if (i === 1) {
        rankings[i].bonus = 2;
        rankings[i].remarks = '2nd';
      }
      rankings[i].totalPoints = rankings[i].wins + rankings[i].bonus;
    }

    // Fetch player names for all rankings
    const playersRes = await store.collection('players').get();
    const playerNameMap = new Map((playersRes.data || []).map(p => [p._id, p.name]));

    for (const r of rankings) {
      r.playerName = playerNameMap.get(r.playerId) || 'Unknown';
    }

    // Compute playerPoints for season aggregation (totalPoints per player)
    const playerPoints = {};
    for (const r of rankings) {
      playerPoints[r.playerId] = r.totalPoints;
    }

    // Build leaderboard object
    const leaderboard = {
      computed: true,
      computedAt: new Date().toISOString(),
      computedBy: OPENID,
      rankings,
      hasTiesAtTop: hasTieForFirst
    };
    if (tieResolution) {
      leaderboard.tieResolution = tieResolution;
    }

    // Update event with leaderboard and playerPoints
    await store.collection('events').doc(eventId).update({
      data: {
        leaderboard,
        playerPoints
      }
    });

    return { eventId, leaderboard };
  },

  async enterResult(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { matchId, score, winner, sets, teamA, teamB, matchType, eventId } = event;

    let match;
    if (matchId) {
      const matchRes = await store.collection('matches').doc(matchId).get();
      match = matchRes.data;
      if (!match) throw new Error('MATCH_NOT_FOUND');
    } else if (teamA && teamB && matchType) {
      const settings = await getSettings();
      const res = await store.collection('matches').add({
        data: {
          eventId: eventId || null,
          seasonId: settings ? settings.activeSeasonId : null,
          matchType,
          teamA,
          teamB,
          participants: teamA.concat(teamB),
          status: 'adhoc',
          generatedAt: new Date().toISOString(),
          approvedBy: null
        }
      });
      const newMatchRes = await store.collection('matches').doc(res._id).get();
      match = newMatchRes.data;
    } else {
      throw new Error('MISSING_FIELDS');
    }

    if (!winner) throw new Error('MISSING_FIELDS');

    const winnerSide = winner.toUpperCase() === 'B' ? 'B' : 'A';
    const winnerPlayers = winnerSide === 'A' ? match.teamA : match.teamB;

    const now = new Date().toISOString();
    const finalScore = sets
      ? sets.map(s => {
          const a = s.teamAGames || 0;
          const b = s.teamBGames || 0;
          const isTiebreak = (a == 4 && b == 3) || (a == 3 && b == 4);
          if (isTiebreak && s.tiebreak !== undefined && s.tiebreak !== '') {
            return `${a}-${b}(${s.tiebreak})`;
          }
          return `${a}-${b}`;
        }).join(' ')
      : (score || '');

    const resultRes = await store.collection('results').add({
      data: {
        matchId: match._id,
        seasonId: match.seasonId || null,
        score: finalScore,
        sets: sets || null,
        winner: winnerSide,
        winnerPlayers,
        enteredBy: OPENID,
        enteredAt: now
      }
    });

    await store.collection('matches').doc(match._id).update({
      data: {
        status: 'completed',
        completedAt: now,
        score: finalScore,
        winner: winnerSide
      }
    });

    // Update player UTR ratings
    await updatePlayerStrength(match, winnerSide, sets);

    // Update event status to match_started if this is the first result
    const matchEventId = match.eventId || eventId;
    if (matchEventId) {
      const eventRes = await store.collection('events').doc(matchEventId).get();
      if (eventRes.data && eventRes.data.status === 'in_progress') {
        await store.collection('events').doc(matchEventId).update({
          data: { status: 'match_started' }
        });
      }
    }

    return { resultId: resultRes._id };
  },

  async listMatches(event) {
    const { OPENID } = getWXContext();
    const { eventId, mine, status, seasonId } = event;

    let matches = [];
    if (mine) {
      const player = await getPlayerByOpenId(OPENID);
      if (!player) return { matches: [] };
      const allMatches = await store.collection('matches').get();
      matches = allMatches.data.filter(m => (m.participants || []).includes(player._id));
    } else if (eventId) {
      const res = await store.collection('matches').where({ eventId }).get();
      matches = res.data || [];
    } else if (seasonId) {
      const res = await store.collection('matches').where({ seasonId }).get();
      matches = res.data || [];
    } else {
      const res = await store.collection('matches').get();
      matches = res.data || [];
    }

    if (status) {
      matches = matches.filter(m => m.status === status);
    }

    const playerIds = new Set();
    const eventIds = new Set();
    matches.forEach(m => {
      (m.teamA || []).forEach(id => playerIds.add(id));
      (m.teamB || []).forEach(id => playerIds.add(id));
      if (m.eventId) eventIds.add(m.eventId);
    });

    const playersRes = await store.collection('players').get();
    const eventsRes = await store.collection('events').get();
    const resultsRes = await store.collection('results').get();
    const playerMap = new Map(playersRes.data.map(p => [p._id, p]));
    const eventMap = new Map(eventsRes.data.map(e => [e._id, e]));
    const resultMap = new Map((resultsRes.data || []).map(r => [r.matchId, r]));

    const enriched = matches.map(m => {
      const result = resultMap.get(m._id);
      return {
        ...m,
        teamANames: (m.teamA || []).map(id => (playerMap.get(id) || {}).name || 'Unknown').join(', '),
        teamBNames: (m.teamB || []).map(id => (playerMap.get(id) || {}).name || 'Unknown').join(', '),
        eventTitle: eventMap.get(m.eventId) ? eventMap.get(m.eventId).title : '',
        score: result ? result.score : '',
        winner: result ? result.winner : ''
      };
    });

    return { matches: enriched };
  },

  async getStats(event) {
    const { OPENID } = getWXContext();
    const { playerId } = event;
    const targetId = playerId || (await getPlayerByOpenId(OPENID))?._id;
    if (!targetId) return { stats: null };

    let stats = null;
    try {
      const res = await store.collection('stats').doc(targetId).get();
      stats = res.data;
    } catch (e) {
      // Stats doc doesn't exist yet
    }

    // Get event breakdown across all completed events
    const eventsRes = await store.collection('events').get();
    const completedEvents = (eventsRes.data || []).filter(e => e.status === 'completed');

    const eventBreakdown = [];
    for (const evt of completedEvents) {
      const evtPoints = evt.playerPoints || {};
      const pts = evtPoints[targetId] || 0;
      if (pts > 0) {
        // Find player's placement in the leaderboard
        let placement = null;
        if (evt.leaderboard && evt.leaderboard.rankings) {
          const playerRanking = evt.leaderboard.rankings.find(r => r.playerId === targetId);
          if (playerRanking && playerRanking.rank <= 2) {
            placement = playerRanking.rank;
          }
        }
        eventBreakdown.push({
          eventId: evt._id,
          eventTitle: evt.title,
          eventDate: evt.date,
          points: pts,
          placement
        });
      }
    }

    // Sort events by date descending
    eventBreakdown.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));

    return {
      stats: stats ? { ...stats, eventBreakdown } : { eventBreakdown }
    };
  },

  async recalculateStats(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    return { recalculated: true };
  },

  async getSeasonStats(event) {
    const { OPENID } = getWXContext();
    let { seasonId, playerId, mine } = event;

    const settings = await getSettings();
    seasonId = seasonId || (settings ? settings.activeSeasonId : null);

    if (!seasonId) {
      return { stats: null, season: null, statsList: [] };
    }

    let season = null;
    try {
      const seasonRes = await store.collection('seasons').doc(seasonId).get();
      season = seasonRes.data;
    } catch (e) {
      // Season not found
    }

    if (event.all) {
      // Fetch all active players to include everyone in leaderboard (even with 0 points)
      const allPlayersRes = await store.collection('players').get();
      const allPlayers = (allPlayersRes.data || []).filter(p => p.isActive !== false);

      const eventsRes = await store.collection('events').where({ seasonId, status: 'completed' }).get();
      const completedEvents = eventsRes.data || [];

      const playerPoints = {};
      for (const evt of completedEvents) {
        const eventPts = evt.playerPoints || {};
        for (const [pid, points] of Object.entries(eventPts)) {
          playerPoints[pid] = (playerPoints[pid] || 0) + points;
        }
      }

      const adjustmentsRes = await store.collection('season_point_adjustments').where({ seasonId }).get();
      const adjustments = adjustmentsRes.data || [];

      const adjustmentsByPlayer = {};
      for (const adj of adjustments) {
        const pid = adj.playerId;
        adjustmentsByPlayer[pid] = (adjustmentsByPlayer[pid] || 0) + (Number(adj.deltaPoints) || 0);
      }

      // Compute wins/losses from completed matches in this season
      const matchesRes = await store.collection('matches').where({ seasonId, status: 'completed' }).get();
      const completedMatches = matchesRes.data || [];
      const matchIds = completedMatches.map(m => m._id);

      const resultsRes = await store.collection('results').get();
      const results = (resultsRes.data || []).filter(r => matchIds.includes(r.matchId));

      // Build wins/losses/matchesPlayed per player
      const playerWins = {};
      const playerMatchesPlayed = {};
      for (const match of completedMatches) {
        const participants = match.participants || [];
        for (const pid of participants) {
          playerMatchesPlayed[pid] = (playerMatchesPlayed[pid] || 0) + 1;
        }
      }
      for (const result of results) {
        const winners = result.winnerPlayers || [];
        for (const pid of winners) {
          playerWins[pid] = (playerWins[pid] || 0) + 1;
        }
      }

      // Include all active players, not just those with points
      const statsList = allPlayers.map(player => {
        const pid = player._id;
        const eventPts = playerPoints[pid] || 0;
        const adjustmentPts = adjustmentsByPlayer[pid] || 0;
        const wins = playerWins[pid] || 0;
        const matchesPlayed = playerMatchesPlayed[pid] || 0;
        const losses = matchesPlayed - wins;
        return {
          playerId: pid,
          playerName: player.name,
          points: eventPts + adjustmentPts,
          eventPoints: eventPts,
          adjustmentPoints: adjustmentPts,
          wins,
          losses,
          matchesPlayed
        };
      });

      // Sort by points descending, then by name ascending for ties
      statsList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return (a.playerName || '').localeCompare(b.playerName || '');
      });

      return { season, statsList };
    }

    if (mine || !playerId) {
      const player = await getPlayerByOpenId(OPENID);
      if (!player) return { stats: null, season };
      playerId = player._id;
    } else {
      await assertAdmin(OPENID);
    }

    const eventsRes = await store.collection('events').where({ seasonId, status: 'completed' }).get();
    const completedEvents = eventsRes.data || [];

    // Build event breakdown: list of events with points earned from each
    const eventBreakdown = [];
    let totalEventPoints = 0;
    for (const evt of completedEvents) {
      const evtPoints = evt.playerPoints || {};
      const pts = evtPoints[playerId] || 0;
      if (pts > 0) {
        // Find player's placement in the leaderboard
        let placement = null;
        if (evt.leaderboard && evt.leaderboard.rankings) {
          const playerRanking = evt.leaderboard.rankings.find(r => r.playerId === playerId);
          if (playerRanking && playerRanking.rank <= 2) {
            placement = playerRanking.rank;
          }
        }
        eventBreakdown.push({
          eventId: evt._id,
          eventTitle: evt.title,
          eventDate: evt.date,
          points: pts,
          placement
        });
      }
      totalEventPoints += pts;
    }

    // Sort events by date descending
    eventBreakdown.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));

    // Get wins/losses/matchesPlayed for this player in this season
    const matchesRes = await store.collection('matches').where({ seasonId, status: 'completed' }).get();
    const completedMatches = matchesRes.data || [];
    const matchIds = completedMatches.map(m => m._id);

    const resultsRes = await store.collection('results').get();
    const results = (resultsRes.data || []).filter(r => matchIds.includes(r.matchId));

    let wins = 0;
    let matchesPlayed = 0;
    for (const match of completedMatches) {
      const participants = match.participants || [];
      if (participants.includes(playerId)) {
        matchesPlayed++;
      }
    }
    for (const result of results) {
      const winners = result.winnerPlayers || [];
      if (winners.includes(playerId)) {
        wins++;
      }
    }
    const losses = matchesPlayed - wins;

    const adjustmentsRes = await store.collection('season_point_adjustments').where({ seasonId, playerId }).get();
    const adjustmentPoints = (adjustmentsRes.data || []).reduce(
      (sum, item) => sum + (Number(item.deltaPoints) || 0),
      0
    );

    const points = totalEventPoints + adjustmentPoints;

    return {
      season,
      stats: {
        seasonId,
        playerId,
        points,
        eventPoints: totalEventPoints,
        adjustmentPoints,
        eventBreakdown,
        wins,
        losses,
        matchesPlayed
      }
    };
  },

  async createSeason(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { name, startDate, endDate } = event;
    const shouldBeActive = event.setActive === true || event.setActive === 'true';
    const now = new Date().toISOString();

    const res = await store.collection('seasons').add({
      data: {
        name,
        startDate,
        endDate: endDate || '',
        status: shouldBeActive ? 'active' : 'inactive',
        createdAt: now,
        closedAt: ''
      }
    });

    await store.collection('seasons').doc(res._id).update({
      data: { seasonId: res._id }
    });

    if (shouldBeActive) {
      const settings = await getSettings();
      if (settings && settings.activeSeasonId) {
        await store.collection('seasons').doc(settings.activeSeasonId).update({
          data: { status: 'inactive' }
        });
      }
      await store.collection('settings').doc('core').update({
        data: { activeSeasonId: res._id }
      });
    }

    return { seasonId: res._id };
  },

  async listSeasons(event) {
    const res = await store.collection('seasons').get();
    const settings = await getSettings();
    return {
      seasons: res.data || [],
      activeSeasonId: settings ? settings.activeSeasonId : null
    };
  },

  async setActiveSeason(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { seasonId } = event;

    const settings = await getSettings();
    const previousId = settings ? settings.activeSeasonId : null;

    if (previousId && previousId !== seasonId) {
      await store.collection('seasons').doc(previousId).update({
        data: { status: 'inactive' }
      });
    }

    if (seasonId) {
      await store.collection('seasons').doc(seasonId).update({
        data: { status: 'active' }
      });
      await store.collection('settings').doc('core').update({
        data: { activeSeasonId: seasonId }
      });
    } else {
      await store.collection('settings').doc('core').update({
        data: { activeSeasonId: null }
      });
    }

    return { success: true };
  },

  async adminAdjustSeasonPoints(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { seasonId, playerId, deltaPoints, reason } = event;
    if (!seasonId || !playerId) throw new Error('MISSING_FIELDS');

    await store.collection('season_point_adjustments').add({
      data: {
        seasonId,
        playerId,
        deltaPoints: deltaPoints || 0,
        reason: reason || '',
        adjustedBy: OPENID,
        adjustedAt: new Date().toISOString()
      }
    });

    return { success: true };
  },

  async adminExportCSV(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { collection } = event;
    const res = await store.collection(collection).get();
    const data = res.data || [];
    if (data.length === 0) return { csv: '' };

    const keys = Object.keys(data[0]);
    const header = keys.join(',');
    const rows = data.map(d => keys.map(k => JSON.stringify(d[k] ?? '')).join(','));
    return { csv: [header, ...rows].join('\n') };
  },

  async adminImportCSV(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    return { count: 0 };
  },

  async deletePlayer(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { playerId } = event;

    if (!playerId) {
      throw new Error('MISSING_PLAYER_ID');
    }

    try {
      await store.collection('players').doc(playerId).get();
    } catch (e) {
      throw new Error('PLAYER_NOT_FOUND');
    }

    await store.collection('players').doc(playerId).remove();

    return { deleted: true, playerId };
  },

  async addMatchup(data) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);

    const { eventId, matchType, teamA, teamB } = data;
    if (!eventId || !matchType || !teamA || !teamB) {
      throw new Error('MISSING_FIELDS');
    }
    if (!VALID_MATCH_TYPES.includes(matchType)) {
      throw new Error('INVALID_MATCH_TYPE');
    }

    const eventRes = await store.collection('events').doc(eventId).get().catch(() => null);
    if (!eventRes || !eventRes.data) {
      throw new Error('EVENT_NOT_FOUND');
    }
    if (eventRes.data.status === 'completed') {
      throw new Error('EVENT_COMPLETED');
    }

    const settings = await getSettings();
    const now = new Date().toISOString();
    const res = await store.collection('matches').add({
      data: {
        eventId,
        matchType,
        teamA,
        teamB,
        status: 'approved',
        seasonId: eventRes.data.seasonId || settings.activeSeasonId,
        createdAt: now,
        updatedAt: now
      }
    });
    await store.collection('matches').doc(res._id).update({
      data: { matchId: res._id }
    });

    return { matchId: res._id };
  },

  async removeSignup(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId, playerId } = event;

    if (!eventId || !playerId) {
      throw new Error('MISSING_FIELDS');
    }

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');

    if (eventData.status === 'completed') {
      throw new Error('EVENT_COMPLETED');
    }

    const existing = await store.collection('signups')
      .where({ eventId, playerId })
      .get();

    if (existing.data.length === 0) {
      throw new Error('NOT_SIGNED_UP');
    }

    await store.collection('signups').doc(existing.data[0]._id).update({
      data: {
        status: 'withdrawn',
        updatedAt: new Date().toISOString()
      }
    });

    // Remove all non-completed matchups involving this player
    const allMatches = await store.collection('matches').where({ eventId }).get();
    const removedMatchups = [];
    for (const match of allMatches.data || []) {
      if (match.status !== 'completed' && (match.participants || []).includes(playerId)) {
        await store.collection('matches').doc(match._id).remove();
        removedMatchups.push(match._id);
      }
    }

    return { success: true, removedMatchups };
  },

  async deleteMatchup(data) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);

    const { matchId } = data;
    if (!matchId) {
      throw new Error('MISSING_FIELDS');
    }

    const matchRes = await store.collection('matches').doc(matchId).get().catch(() => null);
    if (!matchRes || !matchRes.data) {
      throw new Error('MATCH_NOT_FOUND');
    }

    const eventId = matchRes.data.eventId;
    if (eventId) {
      const eventRes = await store.collection('events').doc(eventId).get().catch(() => null);
      if (eventRes && eventRes.data && eventRes.data.status === 'completed') {
        throw new Error('EVENT_COMPLETED');
      }
    }

    await store.collection('matches').doc(matchId).remove();
    return { deleted: true };
  }
};

async function handleLocal(name, data) {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown cloud function: ${name}`);
  }
  const result = await handler(data || {});
  return { result };
}

module.exports = {
  handleLocal,
  handlers
};
