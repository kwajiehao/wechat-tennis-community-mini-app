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
    const res = await store.collection('players').get();
    return { players: res.data || [] };
  },

  async upsertPlayer(event) {
    const { OPENID } = getWXContext();
    const { playerId, createNew, name, gender, ntrp, isActive, notes } = event;
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

    const now = new Date().toISOString();
    if (existing.data.length > 0) {
      await store.collection('signups').doc(existing.data[0]._id).update({
        data: {
          availabilitySlots,
          preferredMatchTypes,
          status: 'signed',
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
        signups = signups.map(s => ({
          ...s,
          playerName: (playerMap.get(s.playerId) || {}).name || 'Unknown',
          playerNtrp: (playerMap.get(s.playerId) || {}).ntrp || null
        }));
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

    const existingMatches = await store.collection('matches').where({ eventId }).get();
    for (const m of existingMatches.data || []) {
      if (['draft', 'needs_admin'].includes(m.status)) {
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

    const matchTypes = eventData.matchTypesAllowed || VALID_MATCH_TYPES;
    const used = new Set();
    const matchesToCreate = [];
    const seasonId = eventData.seasonId;

    function sortByNtrp(list) {
      return list.slice().sort((a, b) => (a.ntrp || 0) - (b.ntrp || 0));
    }

    function makeSingles(candidates) {
      const sorted = sortByNtrp(candidates.map(c => c.player));
      const matches = [];
      for (let i = 0; i < sorted.length; i += 2) {
        if (i + 1 >= sorted.length) break;
        matches.push({ teamA: [sorted[i]._id], teamB: [sorted[i + 1]._id] });
      }
      return { matches };
    }

    function makeDoubles(candidates) {
      const sorted = sortByNtrp(candidates.map(c => c.player));
      const teams = [];
      for (let i = 0; i < sorted.length; i += 2) {
        if (i + 1 >= sorted.length) break;
        teams.push({
          players: [sorted[i], sorted[i + 1]],
          total: (sorted[i].ntrp || 0) + (sorted[i + 1].ntrp || 0)
        });
      }
      teams.sort((a, b) => a.total - b.total);
      const matches = [];
      for (let i = 0; i < teams.length; i += 2) {
        if (i + 1 >= teams.length) break;
        matches.push({
          teamA: teams[i].players.map(p => p._id),
          teamB: teams[i + 1].players.map(p => p._id)
        });
      }
      return { matches };
    }

    function makeMixed(candidates) {
      const males = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'M').map(c => c.player);
      const females = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'F').map(c => c.player);
      const sortedM = sortByNtrp(males);
      const sortedF = sortByNtrp(females);
      const teams = [];
      const pairCount = Math.min(sortedM.length, sortedF.length);
      for (let i = 0; i < pairCount; i++) {
        teams.push({
          players: [sortedM[i], sortedF[i]],
          total: (sortedM[i].ntrp || 0) + (sortedF[i].ntrp || 0)
        });
      }
      teams.sort((a, b) => a.total - b.total);
      const matches = [];
      for (let i = 0; i < teams.length; i += 2) {
        if (i + 1 >= teams.length) break;
        matches.push({
          teamA: teams[i].players.map(p => p._id),
          teamB: teams[i + 1].players.map(p => p._id)
        });
      }
      return { matches };
    }

    for (const matchType of matchTypes) {
      let candidates = roster.filter(r => !used.has(r.player._id));

      let result;
      switch (matchType) {
        case 'mens_singles':
          candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'M');
          result = makeSingles(candidates);
          break;
        case 'womens_singles':
          candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'F');
          result = makeSingles(candidates);
          break;
        case 'mens_doubles':
          candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'M');
          result = makeDoubles(candidates);
          break;
        case 'womens_doubles':
          candidates = candidates.filter(c => (c.player.gender || '').toUpperCase() === 'F');
          result = makeDoubles(candidates);
          break;
        case 'mixed_doubles':
          result = makeMixed(candidates);
          break;
        default:
          continue;
      }

      for (const match of result.matches) {
        match.teamA.forEach(id => used.add(id));
        match.teamB.forEach(id => used.add(id));
        matchesToCreate.push({
          eventId,
          seasonId,
          matchType,
          teamA: match.teamA,
          teamB: match.teamB,
          participants: match.teamA.concat(match.teamB),
          status: 'approved',
          generatedAt: new Date().toISOString(),
          approvedBy: null
        });
      }
    }

    const waitlist = roster.map(r => r.player._id).filter(id => !used.has(id));

    for (const match of matchesToCreate) {
      await store.collection('matches').add({ data: match });
    }

    await store.collection('events').doc(eventId).update({
      data: { waitlist, status: 'in_progress', updatedAt: new Date().toISOString() }
    });

    return { matchCount: matchesToCreate.length, waitlist };
  },

  async regenerateMatchups(event) {
    const { OPENID } = getWXContext();
    await assertAdmin(OPENID);
    const { eventId } = event;
    if (!eventId) throw new Error('MISSING_EVENT_ID');

    const eventRes = await store.collection('events').doc(eventId).get();
    const eventData = eventRes.data;
    if (!eventData) throw new Error('EVENT_NOT_FOUND');

    if (eventData.status === 'in_progress' || eventData.status === 'completed') {
      throw new Error('CANNOT_REGENERATE');
    }

    return handlers.generateMatchups(event);
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
    if (eventData.status !== 'in_progress') throw new Error('EVENT_NOT_IN_PROGRESS');

    const matchesRes = await store.collection('matches').where({ eventId, status: 'completed' }).get();
    const completedMatches = matchesRes.data || [];

    const resultsRes = await store.collection('results').get();
    const results = resultsRes.data || [];
    const resultMap = new Map(results.map(r => [r.matchId, r]));

    const playerPoints = {};
    for (const match of completedMatches) {
      const result = resultMap.get(match._id);
      if (!result) continue;

      const winnerPlayers = result.winnerPlayers || [];
      for (const playerId of winnerPlayers) {
        playerPoints[playerId] = (playerPoints[playerId] || 0) + 1;
      }
    }

    const now = new Date().toISOString();
    await store.collection('events').doc(eventId).update({
      data: {
        status: 'completed',
        playerPoints,
        completedAt: now
      }
    });

    return { eventId, playerPoints };
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

    await store.collection('events').doc(eventId).update({
      data: {
        status: 'in_progress',
        playerPoints: null,
        completedAt: null
      }
    });

    return { eventId };
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
      ? sets.map(s => `${s.teamAGames}-${s.teamBGames}`).join(' ')
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
      data: { status: 'completed', completedAt: now }
    });

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
    try {
      const res = await store.collection('stats').doc(targetId).get();
      return { stats: res.data };
    } catch (e) {
      return { stats: null };
    }
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
      await assertAdmin(OPENID);

      const eventsRes = await store.collection('events').where({ seasonId, status: 'completed' }).get();
      const completedEvents = eventsRes.data || [];

      const playerPoints = {};
      for (const evt of completedEvents) {
        const eventPoints = evt.playerPoints || {};
        for (const [pid, points] of Object.entries(eventPoints)) {
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

      const allPlayerIds = new Set([
        ...Object.keys(playerPoints),
        ...Object.keys(adjustmentsByPlayer)
      ]);

      const statsList = [];
      for (const pid of allPlayerIds) {
        const eventPoints = playerPoints[pid] || 0;
        const adjustmentPoints = adjustmentsByPlayer[pid] || 0;
        statsList.push({
          playerId: pid,
          points: eventPoints + adjustmentPoints,
          eventPoints,
          adjustmentPoints
        });
      }

      statsList.sort((a, b) => b.points - a.points);

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

    let eventPoints = 0;
    for (const evt of completedEvents) {
      const evtPoints = evt.playerPoints || {};
      eventPoints += (evtPoints[playerId] || 0);
    }

    const adjustmentsRes = await store.collection('season_point_adjustments').where({ seasonId, playerId }).get();
    const adjustmentPoints = (adjustmentsRes.data || []).reduce(
      (sum, item) => sum + (Number(item.deltaPoints) || 0),
      0
    );

    const points = eventPoints + adjustmentPoints;

    return {
      season,
      stats: {
        seasonId,
        playerId,
        points,
        eventPoints,
        adjustmentPoints
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
