// ABOUTME: Event detail page showing event info and signup form for players.
// ABOUTME: Displays event details, admin controls for matchups/results, and player signup.

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

function filterPlayersByMatchType(players, matchType) {
  if (!matchType || matchType === 'mixed_doubles') {
    return players;
  }
  const isMensMatch = matchType.startsWith('mens_');
  const requiredGender = isMensMatch ? 'M' : 'F';
  return players.filter(p => (p.gender || '').toUpperCase() === requiredGender);
}

function formatSignupTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

Page({
  data: {
    i18n: {},
    matchTypes: [],
    eventId: '',
    event: null,
    signupStatus: '',
    signedUpPlayers: [],
    matches: [],
    pendingMatches: [],
    isAdmin: false,
    players: [],
    filteredPlayersForMatchup: [],
    showAddMatchup: false,
    showAddPlayer: false,
    availablePlayersForSignup: [],
    selectedPlayerToAdd: [],
    dataLoaded: false,
    newMatchup: {
      matchType: 'mens_singles',
      matchTypeLabel: '',
      maxPlayers: 1,
      teamA: [],
      teamB: []
    },
    resultEntry: {
      selectedMatchId: '',
      selectedMatch: null,
      sets: [{ teamAGames: '', teamBGames: '' }],
      winner: ''
    },
    showTieBreaker: false,
    tiedPlayers: [],
    selectedChampion: '',
    showGameDiff: false
  },
  onLoad(query) {
    initCloud();
    this.loadI18n();
    const eventId = query.eventId || '';
    this.setData({ eventId });
    this.loadInitialData();
  },
  onShow() {
    this.loadI18n();
    if (this.data.dataLoaded) {
      this.loadInitialData();
    }
  },
  loadInitialData() {
    Promise.all([
      this.fetchAdminStatus(),
      this.fetchEventData()
    ]).finally(() => {
      this.setData({ dataLoaded: true });
    });
  },
  loadI18n() {
    const matchTypes = getMatchTypes();
    const defaultType = matchTypes[0];
    this.setData({
      i18n: i18n.getStrings(),
      matchTypes: matchTypes,
      'newMatchup.matchTypeLabel': defaultType ? defaultType.label : ''
    });
  },
  fetchAdminStatus() {
    return callFunction('checkAdmin', {})
      .then(res => {
        this.setData({ isAdmin: res.result.isAdmin === true });
      })
      .catch(() => {
        this.setData({ isAdmin: false });
      });
  },
  fetchEventData() {
    return callFunction('listEvents', { eventId: this.data.eventId })
      .then(res => {
        const event = (res.result.events || [])[0] || null;

        // Compute showGameDiff: show game difference if any adjacent rankings have same wins
        let showGameDiff = false;
        if (event && event.leaderboard && event.leaderboard.rankings) {
          const rankings = event.leaderboard.rankings;
          for (let i = 0; i < rankings.length - 1; i++) {
            if (rankings[i].wins === rankings[i + 1].wins) {
              showGameDiff = true;
              break;
            }
          }
        }

        this.setData({ event, showGameDiff });
        return Promise.all([
          callFunction('listSignups', { eventId: this.data.eventId, mine: true }),
          callFunction('listSignups', { eventId: this.data.eventId, includeNames: true }),
          callFunction('listMatches', { eventId: this.data.eventId })
        ]);
      })
      .then(results => {
        const r0 = (results[0] && results[0].result) || {};
        const r1 = (results[1] && results[1].result) || {};
        const r2 = (results[2] && results[2].result) || {};

        const mySignup = (r0.signups || [])[0];
        const allSignups = r1.signups || [];
        const allMatches = r2.matches || [];

        const sortedSignups = allSignups.slice().sort((a, b) => {
          const timeA = a.createdAt || '';
          const timeB = b.createdAt || '';
          return timeA.localeCompare(timeB);
        });

        const signedUpPlayers = sortedSignups.map(s => ({
          playerId: s.playerId,
          name: s.playerName || 'Unknown',
          ntrp: s.playerNtrp,
          gender: (s.playerGender || '').toUpperCase(),
          isTestPlayer: s.isTestPlayer || false,
          signedUpAt: formatSignupTime(s.createdAt)
        }));

        const matches = allMatches
          .filter(m => m.status === 'approved' || m.status === 'published' || m.status === 'completed')
          .map(m => {
            const typeObj = getMatchTypes().find(t => t.value === m.matchType);
            return {
              ...m,
              matchTypeLabel: typeObj ? typeObj.label : m.matchType
            };
          });

        const pendingMatches = matches.filter(m => m.status !== 'completed');

        this.setData({
          signupStatus: mySignup ? mySignup.status : '',
          signedUpPlayers,
          matches,
          pendingMatches
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_event, icon: 'none' });
      });
  },
  signup() {
    callFunction('signupEvent', {
      eventId: this.data.eventId
    })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_signed_up, icon: 'success' });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        const message = i18n.translateError(err.message) || this.data.i18n.event_signup_failed || 'Signup failed';
        wx.showToast({ title: message, icon: 'none', duration: 3000 });
      });
  },
  withdraw() {
    callFunction('withdrawEvent', {
      eventId: this.data.eventId
    })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_withdrawn, icon: 'success' });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        const message = i18n.translateError(err.message) || this.data.i18n.event_withdraw_failed || 'Withdraw failed';
        wx.showToast({ title: message, icon: 'none' });
      });
  },
  removePlayer(e) {
    const playerId = e.currentTarget.dataset.playerId;
    wx.showModal({
      title: '',
      content: this.data.i18n.admin_confirm_remove_player || 'Remove this player from event?',
      success: (res) => {
        if (res.confirm) {
          callFunction('removeSignup', {
            eventId: this.data.eventId,
            playerId: playerId
          })
            .then((res) => {
              const removedMatchups = (res.result && res.result.removedMatchups) || [];
              this.fetchEventData();
              if (removedMatchups.length > 0 && this.data.event && this.data.event.status === 'in_progress') {
                wx.showModal({
                  title: this.data.i18n.toast_removed || 'Removed',
                  content: this.data.i18n.admin_matchups_removed_regen || 'Matchups involving this player were removed. Regenerate matchups?',
                  confirmText: this.data.i18n.common_yes || 'Yes',
                  cancelText: this.data.i18n.common_no || 'No',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      this.regenerateMatchups();
                    }
                  }
                });
              } else {
                wx.showToast({ title: this.data.i18n.toast_removed || 'Removed', icon: 'success' });
              }
            })
            .catch(err => {
              console.error(err);
              wx.showToast({ title: err.message || 'Remove failed', icon: 'none' });
            });
        }
      }
    });
  },
  generateMatchups() {
    const eventId = this.data.eventId;
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

        wx.showToast({ title: this.data.i18n.toast_generated, icon: 'success' });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Generate failed', icon: 'none' });
      });
  },
  confirmRegenerateMatchups() {
    wx.showModal({
      title: '',
      content: this.data.i18n.admin_confirm_regenerate || 'This will remove existing matchups and create new ones. Continue?',
      success: (res) => {
        if (res.confirm) {
          this.generateMatchups();
        }
      }
    });
  },
  toggleAddPlayer() {
    const showAddPlayer = !this.data.showAddPlayer;
    if (showAddPlayer) {
      this.loadAvailablePlayers();
    } else {
      this.setData({ showAddPlayer: false, selectedPlayerToAdd: [] });
    }
  },
  loadAvailablePlayers() {
    callFunction('listPlayers', {})
      .then(res => {
        const allPlayers = res.result.players || [];
        const signedUpIds = this.data.signedUpPlayers.map(p => p.playerId);
        const available = allPlayers
          .filter(p => !signedUpIds.includes(p._id) && p.name && p.gender && p.ntrp != null)
          .map(p => ({
            _id: p._id,
            name: `${p.name} (${p.gender}, NTRP ${p.ntrp})`
          }));
        this.setData({
          showAddPlayer: true,
          availablePlayersForSignup: available,
          selectedPlayerToAdd: []
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load players', icon: 'none' });
      });
  },
  onAddPlayerChange(e) {
    this.setData({ selectedPlayerToAdd: e.detail.selectedIds || [] });
  },
  addPlayerToEvent() {
    const selected = this.data.selectedPlayerToAdd;
    if (selected.length === 0) {
      wx.showToast({ title: this.data.i18n.admin_select_player || 'Select a player', icon: 'none' });
      return;
    }
    callFunction('signupEvent', {
      eventId: this.data.eventId,
      playerId: selected[0]
    })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_player_signed_up || 'Player signed up', icon: 'success' });
        this.setData({ showAddPlayer: false, selectedPlayerToAdd: [] });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        const message = i18n.translateError(err.message) || 'Signup failed';
        wx.showToast({ title: message, icon: 'none' });
      });
  },
  completeEvent() {
    const eventId = this.data.eventId;
    callFunction('completeEvent', { eventId })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_event_completed, icon: 'success' });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Complete failed', icon: 'none' });
      });
  },
  reopenEvent() {
    const eventId = this.data.eventId;
    callFunction('reopenEvent', { eventId })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_event_reopened, icon: 'success' });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Reopen failed', icon: 'none' });
      });
  },
  toggleAddMatchup() {
    const showAddMatchup = !this.data.showAddMatchup;
    if (showAddMatchup && this.data.players.length === 0) {
      callFunction('listPlayers', {})
        .then(res => {
          const allPlayers = res.result.players || [];
          const filteredPlayersForMatchup = filterPlayersByMatchType(allPlayers, this.data.newMatchup.matchType);
          this.setData({
            showAddMatchup: true,
            players: allPlayers,
            filteredPlayersForMatchup
          });
        })
        .catch(err => {
          console.error(err);
          wx.showToast({ title: 'Failed to load players', icon: 'none' });
        });
    } else {
      this.setData({ showAddMatchup });
    }
  },
  onAddMatchupTypePicker(e) {
    const index = e.detail.value;
    const matchType = this.data.matchTypes[index];
    const value = matchType ? matchType.value : 'mens_singles';
    const label = matchType ? matchType.label : '';
    const isDoubles = value.indexOf('doubles') >= 0;
    const filteredPlayersForMatchup = filterPlayersByMatchType(this.data.players, value);
    this.setData({
      'newMatchup.matchType': value,
      'newMatchup.matchTypeLabel': label,
      'newMatchup.maxPlayers': isDoubles ? 2 : 1,
      'newMatchup.teamA': [],
      'newMatchup.teamB': [],
      filteredPlayersForMatchup
    });
  },
  onAddMatchupTeamAChange(e) {
    this.setData({ 'newMatchup.teamA': e.detail.selectedIds });
  },
  onAddMatchupTeamBChange(e) {
    this.setData({ 'newMatchup.teamB': e.detail.selectedIds });
  },
  addMatchup() {
    const newMatchup = this.data.newMatchup;
    if (newMatchup.teamA.length === 0 || newMatchup.teamB.length === 0) {
      wx.showToast({ title: this.data.i18n.admin_select_players || 'Select players', icon: 'none' });
      return;
    }
    callFunction('addMatchup', {
      eventId: this.data.eventId,
      matchType: newMatchup.matchType,
      teamA: newMatchup.teamA,
      teamB: newMatchup.teamB
    })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_matchup_added, icon: 'success' });
        const defaultType = this.data.matchTypes[0];
        this.setData({
          showAddMatchup: false,
          'newMatchup.teamA': [],
          'newMatchup.teamB': [],
          'newMatchup.matchType': defaultType ? defaultType.value : 'mens_singles',
          'newMatchup.matchTypeLabel': defaultType ? defaultType.label : '',
          'newMatchup.maxPlayers': 1
        });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Failed to add matchup', icon: 'none' });
      });
  },
  deleteMatchup(e) {
    const matchId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '',
      content: this.data.i18n.admin_confirm_delete_matchup || 'Delete this matchup?',
      success: (res) => {
        if (res.confirm) {
          callFunction('deleteMatchup', { matchId })
            .then(() => {
              wx.showToast({ title: this.data.i18n.toast_deleted, icon: 'success' });
              this.fetchEventData();
            })
            .catch(err => {
              console.error(err);
              wx.showToast({ title: err.message || 'Delete failed', icon: 'none' });
            });
        }
      }
    });
  },
  onResultMatchSelect(e) {
    const matchId = e.currentTarget.dataset.id;
    const match = this.data.pendingMatches.find(m => m._id === matchId) || null;
    this.setData({
      'resultEntry.selectedMatchId': matchId,
      'resultEntry.selectedMatch': match
    });
  },
  onSetScoreInput(e) {
    const { index, team } = e.currentTarget.dataset;
    const sets = this.data.resultEntry.sets.slice();
    sets[index] = { ...sets[index], [team]: e.detail.value };
    // Clear tiebreak if no longer a 4-3 or 3-4 set
    const a = sets[index].teamAGames;
    const b = sets[index].teamBGames;
    if (!((a === '4' && b === '3') || (a === '3' && b === '4'))) {
      delete sets[index].tiebreak;
    }
    this.setData({ 'resultEntry.sets': sets });
  },
  onTiebreakInput(e) {
    const { index } = e.currentTarget.dataset;
    const sets = this.data.resultEntry.sets.slice();
    sets[index] = { ...sets[index], tiebreak: e.detail.value };
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

    if (!entry.selectedMatchId) {
      wx.showToast({ title: this.data.i18n.toast_select_match, icon: 'none' });
      return;
    }

    if (!entry.winner) {
      wx.showToast({ title: this.data.i18n.toast_select_winner, icon: 'none' });
      return;
    }

    callFunction('enterResult', {
      matchId: entry.selectedMatchId,
      winner: entry.winner,
      sets: sets.length > 0 ? sets : null
    })
      .then(() => {
        wx.showToast({ title: this.data.i18n.toast_result_saved, icon: 'success' });
        this.setData({
          'resultEntry.selectedMatchId': '',
          'resultEntry.selectedMatch': null,
          'resultEntry.sets': [{ teamAGames: '', teamBGames: '' }],
          'resultEntry.winner': ''
        });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Save failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  computeScore() {
    wx.showModal({
      title: this.data.i18n.admin_compute_score_title || 'Compute Final Score',
      content: this.data.i18n.admin_compute_score_warning ||
        'This will calculate the final leaderboard and lock the event. You will not be able to reopen it. Continue?',
      confirmText: this.data.i18n.common_confirm || 'Confirm',
      cancelText: this.data.i18n.common_cancel || 'Cancel',
      success: (res) => {
        if (res.confirm) {
          this.executeComputeScore(null);
        }
      }
    });
  },
  executeComputeScore(championId) {
    const eventId = this.data.eventId;
    callFunction('computeEventScore', { eventId, championId })
      .then(res => {
        const result = res.result || {};

        if (result.requiresTieBreak) {
          this.setData({
            showTieBreaker: true,
            tiedPlayers: result.rankings || [],
            selectedChampion: ''
          });
          return;
        }

        wx.showToast({
          title: this.data.i18n.toast_score_computed || 'Score computed',
          icon: 'success'
        });
        this.fetchEventData();
      })
      .catch(err => {
        console.error(err);
        const msg = i18n.translateError(err.message) || 'Compute failed';
        wx.showToast({ title: msg, icon: 'none' });
      });
  },
  selectChampion(e) {
    const playerId = e.currentTarget.dataset.playerId;
    this.setData({ selectedChampion: playerId });
  },
  closeTieBreaker() {
    this.setData({
      showTieBreaker: false,
      tiedPlayers: [],
      selectedChampion: ''
    });
  },
  confirmChampion() {
    const championId = this.data.selectedChampion;
    if (!championId) {
      wx.showToast({
        title: this.data.i18n.admin_select_champion || 'Select a champion',
        icon: 'none'
      });
      return;
    }

    this.setData({ showTieBreaker: false });
    this.executeComputeScore(championId);
  }
});
