// ABOUTME: Players list page showing all registered players.
// ABOUTME: Includes admin delete functionality and player detail modal.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    allPlayers: [],
    players: [],
    playerStats: {},
    loading: false,
    isAdmin: false,
    genderFilter: 'all',
    sortBy: 'ntrp',
    // Player detail modal
    modal: {
      visible: false,
      player: null,
      stats: null
    }
  },

  onLoad() {
    initCloud();
    this.loadI18n();
    this.checkAdminStatus();
    this.fetchPlayers();
  },

  onShow() {
    this.loadI18n();
  },

  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },

  checkAdminStatus() {
    callFunction('checkAdmin', {})
      .then(res => {
        this.setData({ isAdmin: res.result.isAdmin });
      })
      .catch(err => {
        console.error('Failed to check admin status:', err);
        this.setData({ isAdmin: false });
      });
  },

  onPullDownRefresh() {
    this.fetchPlayers().finally(() => wx.stopPullDownRefresh());
  },

  fetchPlayers() {
    this.setData({ loading: true });
    return callFunction('listPlayers', {})
      .then(playersRes => {
        const allPlayers = (playersRes.result.players || [])
          .filter(p => p.isActive !== false)
          .map(p => ({ ...p, gender: (p.gender || '').toUpperCase() }));
        this.setData({ allPlayers });

        // Try to fetch stats (admin-only), but don't fail if not authorized
        return callFunction('getSeasonStats', { all: true })
          .then(statsRes => {
            const statsList = statsRes.result.statsList || [];
            const playerStats = {};
            statsList.forEach(s => {
              playerStats[s.playerId] = s;
            });
            this.setData({ playerStats });
          })
          .catch(() => {
            // Non-admin users can't fetch all stats, that's ok
            this.setData({ playerStats: {} });
          });
      })
      .then(() => {
        this.applyFiltersAndSort();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_players, icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  onGenderFilterChange(e) {
    this.setData({ genderFilter: e.detail.value });
    this.applyFiltersAndSort();
  },

  onSortChange(e) {
    this.setData({ sortBy: e.detail.value });
    this.applyFiltersAndSort();
  },

  applyFiltersAndSort() {
    let players = this.data.allPlayers.slice();
    const genderFilter = this.data.genderFilter;
    const sortBy = this.data.sortBy;
    const stats = this.data.playerStats;

    // Add stats to each player
    players = players.map(p => ({
      ...p,
      points: stats[p._id] ? stats[p._id].points : 0
    }));

    if (genderFilter === 'M') {
      players = players.filter(p => (p.gender || '').toUpperCase() === 'M');
    } else if (genderFilter === 'F') {
      players = players.filter(p => (p.gender || '').toUpperCase() === 'F');
    }

    if (sortBy === 'ntrp') {
      players.sort((a, b) => {
        const ntrpA = a.ntrp || 0;
        const ntrpB = b.ntrp || 0;
        if (ntrpB !== ntrpA) return ntrpB - ntrpA;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else if (sortBy === 'name') {
      players.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    this.setData({ players });
  },

  // Player detail modal
  openPlayerModal(e) {
    const playerId = e.currentTarget.dataset.id;
    const player = this.data.allPlayers.find(p => p._id === playerId);
    if (!player) return;

    const stats = this.data.playerStats[playerId] || null;
    this.setData({
      'modal.visible': true,
      'modal.player': player,
      'modal.stats': stats
    });
  },

  closePlayerModal() {
    this.setData({
      'modal.visible': false,
      'modal.player': null,
      'modal.stats': null
    });
  },

  deletePlayer() {
    const player = this.data.modal.player;
    if (!player) return;

    const confirmMsg = (this.data.i18n.admin_confirm_delete_player || 'Are you sure you want to delete this player?') + `\n\n${player.name}`;
    wx.showModal({
      title: '',
      content: confirmMsg,
      success: (res) => {
        if (res.confirm) {
          callFunction('deletePlayer', { playerId: player._id })
            .then(() => {
              wx.showToast({ title: this.data.i18n.toast_deleted, icon: 'success' });
              this.closePlayerModal();
              this.fetchPlayers();
            })
            .catch(err => {
              console.error(err);
              wx.showToast({ title: err.message || 'Delete failed', icon: 'none' });
            });
        }
      }
    });
  },
  onShareAppMessage() {
    return {
      title: this.data.i18n.players_title || 'Players',
      path: '/pages/players/players',
      imageUrl: '/images/share.jpg'
    };
  },
  onShareTimeline() {
    return {
      title: this.data.i18n.players_title || 'Players'
    };
  }
});
