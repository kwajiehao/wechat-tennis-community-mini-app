// ABOUTME: Players list page showing all registered players.
// ABOUTME: Displays player names, NTRP ratings, and gender with sorting options.

const { callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    allPlayers: [],
    players: [],
    loading: false,
    genderFilter: 'all',
    sortBy: 'ntrp'
  },

  onLoad() {
    this.loadI18n();
    this.fetchPlayers();
  },

  onShow() {
    this.loadI18n();
  },

  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },

  onPullDownRefresh() {
    this.fetchPlayers().finally(() => wx.stopPullDownRefresh());
  },

  fetchPlayers() {
    this.setData({ loading: true });
    return callFunction('listPlayers', {})
      .then(res => {
        const allPlayers = (res.result.players || [])
          .filter(p => p.isActive !== false);
        this.setData({ allPlayers });
        this.applyFiltersAndSort();
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load players', icon: 'none' });
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
  }
});
