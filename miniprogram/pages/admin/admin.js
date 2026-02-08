// ABOUTME: Admin page for managing seasons, events, players, and match results.
// ABOUTME: Provides CRUD operations and matchup generation for tennis league admins.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

function getMatchTypes() {
  const strs = i18n.getStrings();
  return [
    { value: 'mens_singles', label: strs.match_mens_singles },
    { value: 'womens_singles', label: strs.match_womens_singles },
    { value: 'mens_doubles', label: strs.match_mens_doubles },
    { value: 'womens_doubles', label: strs.match_womens_doubles },
    { value: 'mixed_doubles', label: strs.match_mixed_doubles }
  ];
}

Page({
  data: {
    i18n: {},
    matchTypes: [],
    events: [],
    players: [],
    seasons: [],
    activeSeasonId: '',
    newSeason: {
      name: '',
      startDate: '',
      endDate: '',
      setActive: 'true'
    },
    seasonAdjustInput: {
      seasonId: '',
      seasonName: '',
      playerId: '',
      playerName: '',
      deltaPoints: '',
      reason: ''
    },
    newEvent: {
      title: '',
      date: '',
      location: '',
      startTime: '',
      endTime: ''
    },
    resultEntry: {
      mode: 'matchmaking',
      selectedEventId: '',
      selectedEventTitle: '',
      availableMatches: [],
      selectedMatchId: '',
      selectedMatch: null,
      matchType: 'mens_singles',
      matchTypeLabel: '',
      maxSelectPlayers: 1,
      teamA: [],
      teamB: [],
      teamANames: '',
      teamBNames: '',
      sets: [{ teamAGames: '', teamBGames: '' }],
      winner: ''
    },
    playerInput: {
      playerId: '',
      name: '',
      gender: 'M',
      genderIndex: 0,
      ntrp: '',
      ntrpIndex: -1,
      isActive: 'true',
      notes: ''
    },
    genderOptions: ['M', 'F'],
    ntrpOptions: ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0'],
    matchupsModal: {
      visible: false,
      eventId: '',
      eventTitle: '',
      matches: [],
      waitlist: [],
      waitlistNames: ''
    },
    adminSignup: {
      playerId: '',
      playerName: '',
      eventId: '',
      eventTitle: '',
      availablePlayers: []
    }
  },
  onLoad() {
    initCloud();
    this.loadI18n();
    this.refresh();
  },
  onShow() {
    this.loadI18n();
    this.refresh();
  },
  loadI18n() {
    const matchTypes = getMatchTypes();
    const currentType = this.data.resultEntry.matchType;
    const found = matchTypes.find(m => m.value === currentType);
    this.setData({
      i18n: i18n.getStrings(),
      matchTypes: matchTypes,
      'resultEntry.matchTypeLabel': found ? found.label : matchTypes[0].label
    });
  },
  refresh() {
    this.fetchEvents();
    this.fetchPlayers();
    this.fetchSeasons();
  },
  fetchEvents() {
    callFunction('listEvents', {})
      .then(res => {
        this.setData({ events: res.result.events || [] });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load events', icon: 'none' });
      });
  },
  fetchPlayers() {
    callFunction('listPlayers', {})
      .then(res => {
        this.setData({ players: res.result.players || [] });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load players', icon: 'none' });
      });
  },
  fetchSeasons() {
    callFunction('listSeasons', {})
      .then(res => {
        const seasons = res.result.seasons || [];
        this.setData({
          seasons,
          activeSeasonId: res.result.activeSeasonId || ''
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load seasons', icon: 'none' });
      });
  },
  onNewSeasonInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newSeason.${field}`]: e.detail.value });
  },
  onSetActiveToggle(e) {
    this.setData({ 'newSeason.setActive': e.detail.value ? 'true' : 'false' });
  },
  createSeason() {
    const data = this.data.newSeason;

    callFunction('createSeason', {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      setActive: data.setActive === 'true'
    })
      .then(() => {
        wx.showToast({ title: 'Season created', icon: 'success' });
        this.fetchSeasons();
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Create failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  setActiveSeason(e) {
    const seasonId = e.currentTarget.dataset.id;
    const isCurrentlyActive = seasonId === this.data.activeSeasonId;
    const newSeasonId = isCurrentlyActive ? null : seasonId;

    callFunction('setActiveSeason', { seasonId: newSeasonId })
      .then(() => {
        wx.showToast({ title: isCurrentlyActive ? 'Deactivated' : 'Activated', icon: 'success' });
        this.fetchSeasons();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Update failed', icon: 'none' });
      });
  },
  completeEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    callFunction('completeEvent', { eventId })
      .then(() => {
        wx.showToast({ title: 'Event completed', icon: 'success' });
        this.fetchEvents();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Complete failed', icon: 'none' });
      });
  },
  reopenEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    callFunction('reopenEvent', { eventId })
      .then(() => {
        wx.showToast({ title: 'Event reopened', icon: 'success' });
        this.fetchEvents();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Reopen failed', icon: 'none' });
      });
  },
  onSeasonAdjustInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`seasonAdjustInput.${field}`]: e.detail.value });
  },
  onAdjustSeasonPicker(e) {
    const index = e.detail.value;
    const season = this.data.seasons[index];
    if (season) {
      this.setData({
        'seasonAdjustInput.seasonId': season._id,
        'seasonAdjustInput.seasonName': season.name
      });
    }
  },
  onAdjustPlayerPicker(e) {
    const index = e.detail.value;
    const player = this.data.players[index];
    if (player) {
      this.setData({
        'seasonAdjustInput.playerId': player._id,
        'seasonAdjustInput.playerName': player.name
      });
    }
  },
  adjustSeasonPoints() {
    const input = this.data.seasonAdjustInput;
    const delta = parseFloat(input.deltaPoints);
    callFunction('adminAdjustSeasonPoints', {
      seasonId: input.seasonId,
      playerId: input.playerId,
      deltaPoints: Number.isNaN(delta) ? 0 : delta,
      reason: input.reason
    })
      .then(() => {
        wx.showToast({ title: 'Adjusted', icon: 'success' });
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Adjustment failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  onNewEventInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`newEvent.${field}`]: e.detail.value });
  },
  onEventDateChange(e) {
    this.setData({ 'newEvent.date': e.detail.value });
  },
  onEventStartTimeChange(e) {
    this.setData({ 'newEvent.startTime': e.detail.value });
  },
  onEventEndTimeChange(e) {
    this.setData({ 'newEvent.endTime': e.detail.value });
  },
  createEvent() {
    const data = this.data.newEvent;
    callFunction('createEvent', {
      title: data.title,
      date: data.date,
      location: data.location,
      startTime: data.startTime,
      endTime: data.endTime
    })
      .then(() => {
        wx.showToast({ title: 'Event created', icon: 'success' });
        this.fetchEvents();
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message, 'event') || 'Create failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  goToEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/event/event?eventId=${eventId}`
    });
  },
  generateMatchups(e) {
    const eventId = e.currentTarget.dataset.id;
    const event = this.data.events.find(ev => ev._id === eventId);
    callFunction('generateMatchups', { eventId })
      .then(res => {
        const result = res.result || {};
        const matchCount = result.matchCount || 0;
        const waitlistCount = (result.waitlist || []).length;
        const totalPlayers = matchCount * 2 + waitlistCount;

        if (totalPlayers < 2) {
          wx.showToast({ title: this.data.i18n.admin_need_players || 'Need at least 2 players signed up', icon: 'none' });
          return;
        }

        wx.showToast({ title: 'Generated', icon: 'success' });
        this.loadMatchupsForModal(eventId, event ? event.title : 'Event');
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Generate failed', icon: 'none' });
      });
  },
  viewMatchups(e) {
    const eventId = e.currentTarget.dataset.id;
    const event = this.data.events.find(ev => ev._id === eventId);
    this.loadMatchupsForModal(eventId, event ? event.title : 'Event');
  },
  loadMatchupsForModal(eventId, eventTitle) {
    const players = this.data.players;
    const playerMap = new Map(players.map(p => [p._id, p.name || 'Unknown']));
    const matchTypes = this.data.matchTypes;

    callFunction('listMatches', { eventId })
      .then(res => {
        const matches = (res.result.matches || []).map(m => {
          const teamANames = (m.teamA || []).map(id => playerMap.get(id) || id).join(', ');
          const teamBNames = (m.teamB || []).map(id => playerMap.get(id) || id).join(', ');
          const typeObj = matchTypes.find(t => t.value === m.matchType);
          return {
            ...m,
            teamANames,
            teamBNames,
            matchTypeLabel: typeObj ? typeObj.label : m.matchType
          };
        });

        const eventData = this.data.events.find(ev => ev._id === eventId);
        let waitlist = eventData && eventData.waitlist ? eventData.waitlist : [];
        if (!Array.isArray(waitlist)) {
          waitlist = Object.values(waitlist).flat();
        }
        const waitlistNames = waitlist.map(id => playerMap.get(id) || id).join(', ');

        this.setData({
          'matchupsModal.visible': true,
          'matchupsModal.eventId': eventId,
          'matchupsModal.eventTitle': eventTitle,
          'matchupsModal.matches': matches,
          'matchupsModal.waitlist': waitlist,
          'matchupsModal.waitlistNames': waitlistNames
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load matchups', icon: 'none' });
      });
  },
  closeMatchupsModal() {
    this.setData({ 'matchupsModal.visible': false });
  },
  approveMatchups(e) {
    const eventId = e.currentTarget.dataset.id;
    callFunction('approveMatchups', { eventId })
      .then(() => {
        wx.showToast({ title: 'Approved', icon: 'success' });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Approve failed', icon: 'none' });
      });
  },
  regenerateMatchups(e) {
    const eventId = e.currentTarget.dataset.id;
    callFunction('regenerateMatchups', { eventId })
      .then(() => {
        wx.showToast({ title: 'Regenerated', icon: 'success' });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Regenerate failed', icon: 'none' });
      });
  },
  onResultModeChange(e) {
    const mode = e.detail.value;
    const defaultType = this.data.matchTypes[0];
    this.setData({
      'resultEntry.mode': mode,
      'resultEntry.selectedEventId': '',
      'resultEntry.selectedEventTitle': '',
      'resultEntry.availableMatches': [],
      'resultEntry.selectedMatchId': '',
      'resultEntry.selectedMatch': null,
      'resultEntry.matchType': defaultType ? defaultType.value : 'mens_singles',
      'resultEntry.matchTypeLabel': defaultType ? defaultType.label : '',
      'resultEntry.maxSelectPlayers': 1,
      'resultEntry.teamA': [],
      'resultEntry.teamB': [],
      'resultEntry.teamANames': '',
      'resultEntry.teamBNames': '',
      'resultEntry.sets': [{ teamAGames: '', teamBGames: '' }],
      'resultEntry.winner': ''
    });
  },

  onResultEventChange(e) {
    const index = e.detail.value;
    const event = this.data.events[index];
    const eventId = event ? event._id : '';
    const eventTitle = event ? event.title : '';

    this.setData({
      'resultEntry.selectedEventId': eventId,
      'resultEntry.selectedEventTitle': eventTitle,
      'resultEntry.selectedMatchId': '',
      'resultEntry.selectedMatch': null,
      'resultEntry.availableMatches': []
    });

    if (!eventId) return;

    callFunction('listMatches', { eventId })
      .then(res => {
        const matches = (res.result.matches || []).filter(m =>
          m.status === 'approved' || m.status === 'draft' || m.status === 'published'
        );
        this.setData({ 'resultEntry.availableMatches': matches });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load matches', icon: 'none' });
      });
  },

  onResultMatchSelect(e) {
    const matchId = e.currentTarget.dataset.id;
    const matches = this.data.resultEntry.availableMatches;
    const match = matches.find(m => m._id === matchId) || null;
    this.setData({
      'resultEntry.selectedMatchId': matchId,
      'resultEntry.selectedMatch': match
    });
  },

  onResultMatchTypePicker(e) {
    const index = e.detail.value;
    const matchType = this.data.matchTypes[index];
    const value = matchType ? matchType.value : 'mens_singles';
    const label = matchType ? matchType.label : '';
    const isDoubles = value.indexOf('doubles') >= 0;
    this.setData({
      'resultEntry.matchType': value,
      'resultEntry.matchTypeLabel': label,
      'resultEntry.maxSelectPlayers': isDoubles ? 2 : 1
    });
  },

  onTeamAChange(e) {
    const ids = e.detail.selectedIds;
    const playerMap = new Map(this.data.players.map(p => [p._id, p.name || 'Unknown']));
    const names = ids.map(id => playerMap.get(id) || id).join(', ');
    this.setData({
      'resultEntry.teamA': ids,
      'resultEntry.teamANames': names
    });
  },

  onTeamBChange(e) {
    const ids = e.detail.selectedIds;
    const playerMap = new Map(this.data.players.map(p => [p._id, p.name || 'Unknown']));
    const names = ids.map(id => playerMap.get(id) || id).join(', ');
    this.setData({
      'resultEntry.teamB': ids,
      'resultEntry.teamBNames': names
    });
  },

  onSetScoreInput(e) {
    const { index, team } = e.currentTarget.dataset;
    const sets = this.data.resultEntry.sets.slice();
    sets[index] = { ...sets[index], [team]: e.detail.value };
    this.setData({ 'resultEntry.sets': sets });
  },

  addSet() {
    const sets = this.data.resultEntry.sets.slice();
    sets.push({ teamAGames: '', teamBGames: '' });
    this.setData({ 'resultEntry.sets': sets });
  },

  removeSet() {
    const sets = this.data.resultEntry.sets.slice();
    if (sets.length > 1) {
      sets.pop();
      this.setData({ 'resultEntry.sets': sets });
    }
  },

  selectWinner(e) {
    const winner = e.currentTarget.dataset.winner;
    this.setData({ 'resultEntry.winner': winner });
  },

  enterResult() {
    const entry = this.data.resultEntry;
    const sets = entry.sets.filter(s => s.teamAGames !== '' || s.teamBGames !== '');

    if (!entry.winner) {
      wx.showToast({ title: 'Select a winner', icon: 'none' });
      return;
    }

    let payload = {
      winner: entry.winner,
      sets: sets.length > 0 ? sets : null
    };

    if (entry.mode === 'matchmaking') {
      if (!entry.selectedMatchId) {
        wx.showToast({ title: 'Select a match', icon: 'none' });
        return;
      }
      payload.matchId = entry.selectedMatchId;
    } else {
      if (entry.teamA.length === 0 || entry.teamB.length === 0) {
        wx.showToast({ title: 'Select players for both teams', icon: 'none' });
        return;
      }
      payload.teamA = entry.teamA;
      payload.teamB = entry.teamB;
      payload.matchType = entry.matchType;
    }

    callFunction('enterResult', payload)
      .then(() => {
        wx.showToast({ title: 'Result saved', icon: 'success' });
        this.setData({
          'resultEntry.selectedMatchId': '',
          'resultEntry.selectedMatch': null,
          'resultEntry.teamA': [],
          'resultEntry.teamB': [],
          'resultEntry.sets': [{ teamAGames: '', teamBGames: '' }],
          'resultEntry.winner': ''
        });
        if (entry.mode === 'matchmaking' && entry.selectedEventId) {
          const eventIndex = this.data.events.findIndex(e => e._id === entry.selectedEventId);
          if (eventIndex >= 0) {
            this.onResultEventChange({ detail: { value: eventIndex } });
          }
        }
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Save failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  onPlayerInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`playerInput.${field}`]: e.detail.value });
  },
  onPlayerGenderChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      'playerInput.genderIndex': index,
      'playerInput.gender': this.data.genderOptions[index]
    });
  },
  onPlayerNtrpChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      'playerInput.ntrpIndex': index,
      'playerInput.ntrp': this.data.ntrpOptions[index]
    });
  },
  upsertPlayer() {
    const input = this.data.playerInput;
    const ntrpValue = parseFloat(input.ntrp);
    const hasPlayerId = input.playerId && input.playerId.trim() !== '';

    const payload = {
      name: input.name,
      gender: input.gender,
      ntrp: Number.isNaN(ntrpValue) ? null : ntrpValue,
      isActive: input.isActive === 'true',
      notes: input.notes
    };

    if (hasPlayerId) {
      payload.playerId = input.playerId;
    } else {
      payload.createNew = true;
    }

    callFunction('upsertPlayer', payload)
      .then(() => {
        wx.showToast({ title: 'Player saved', icon: 'success' });
        this.setData({
          'playerInput.playerId': '',
          'playerInput.name': '',
          'playerInput.gender': 'M',
          'playerInput.genderIndex': 0,
          'playerInput.ntrp': '',
          'playerInput.ntrpIndex': -1,
          'playerInput.notes': ''
        });
        this.fetchPlayers();
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Save failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  viewSeasonResults(e) {
    const seasonId = e.currentTarget.dataset.id;
    const season = this.data.seasons.find(s => s._id === seasonId);
    const seasonName = season ? season.name : 'Season';
    wx.navigateTo({
      url: `/pages/season/season?seasonId=${seasonId}&seasonName=${encodeURIComponent(seasonName)}`
    });
  },
  onAdminSignupEventPicker(e) {
    const index = e.detail.value;
    const event = this.data.events[index];
    if (!event) return;

    this.setData({
      'adminSignup.eventId': event._id,
      'adminSignup.eventTitle': event.title,
      'adminSignup.playerId': '',
      'adminSignup.playerName': '',
      'adminSignup.availablePlayers': []
    });

    Promise.all([
      callFunction('listPlayers', {}),
      callFunction('listSignups', { eventId: event._id })
    ])
      .then(([playersRes, signupsRes]) => {
        const allPlayers = playersRes.result.players || [];
        const signups = signupsRes.result.signups || [];
        const signedUpPlayerIds = new Set(signups.map(s => s.playerId));
        const availablePlayers = allPlayers.filter(p => !signedUpPlayerIds.has(p._id));
        this.setData({
          players: allPlayers,
          'adminSignup.availablePlayers': availablePlayers
        });
      })
      .catch(err => {
        console.error(err);
        this.setData({ 'adminSignup.availablePlayers': this.data.players });
      });
  },
  refreshAvailablePlayers() {
    const eventId = this.data.adminSignup.eventId;
    if (!eventId) return;

    Promise.all([
      callFunction('listPlayers', {}),
      callFunction('listSignups', { eventId })
    ])
      .then(([playersRes, signupsRes]) => {
        const allPlayers = playersRes.result.players || [];
        const signups = signupsRes.result.signups || [];
        const signedUpPlayerIds = new Set(signups.map(s => s.playerId));
        const availablePlayers = allPlayers.filter(p => !signedUpPlayerIds.has(p._id));
        this.setData({
          players: allPlayers,
          'adminSignup.availablePlayers': availablePlayers
        });
      })
      .catch(err => {
        console.error(err);
      });
  },
  onAdminSignupPlayerPicker(e) {
    const index = e.detail.value;
    const player = this.data.adminSignup.availablePlayers[index];
    if (player) {
      this.setData({
        'adminSignup.playerId': player._id,
        'adminSignup.playerName': player.name
      });
    }
  },
  adminSignupPlayer() {
    const input = this.data.adminSignup;
    if (!input.playerId || !input.eventId) {
      wx.showToast({ title: 'Select player and event', icon: 'none' });
      return;
    }
    callFunction('signupEvent', {
      eventId: input.eventId,
      playerId: input.playerId
    })
      .then(() => {
        wx.showToast({ title: 'Player signed up', icon: 'success' });
        const availablePlayers = this.data.adminSignup.availablePlayers.filter(
          p => p._id !== input.playerId
        );
        this.setData({
          'adminSignup.playerId': '',
          'adminSignup.playerName': '',
          'adminSignup.availablePlayers': availablePlayers
        });
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Signup failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  }
});
