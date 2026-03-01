// ABOUTME: Leaderboard page showing player rankings with a season selector.
// ABOUTME: Displays games played, wins, losses, and points in a table format.

const { callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    season: null,
    leaderboard: [],
    loading: true,
    seasons: [],
    filterOptions: [],
    selectedFilter: '',
    selectedFilterLabel: ''
  },

  onLoad(options) {
    this.loadI18n();
    this._initialSeasonId = options.seasonId || '';
    this.loadSeasons();
  },

  onShow() {
    this.loadI18n();
  },

  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },

  loadSeasons() {
    this.setData({ loading: true });
    callFunction('listSeasons', {})
      .then(res => {
        const seasons = res.result.seasons || [];
        const activeSeasonId = res.result.activeSeasonId;

        const sortedSeasons = seasons.slice().sort((a, b) => {
          return (b.startDate || '').localeCompare(a.startDate || '');
        });

        const filterOptions = sortedSeasons.map(season => ({
          value: season._id,
          label: season.name
        }));

        let selectedFilter = '';
        let selectedFilterLabel = '';

        // Prefer URL-provided seasonId, then active season, then first
        if (this._initialSeasonId) {
          const urlOption = filterOptions.find(o => o.value === this._initialSeasonId);
          if (urlOption) {
            selectedFilter = urlOption.value;
            selectedFilterLabel = urlOption.label;
          }
        }
        if (!selectedFilter && activeSeasonId) {
          const activeOption = filterOptions.find(o => o.value === activeSeasonId);
          if (activeOption) {
            selectedFilter = activeSeasonId;
            selectedFilterLabel = activeOption.label;
          }
        }
        if (!selectedFilter && filterOptions.length > 0) {
          selectedFilter = filterOptions[0].value;
          selectedFilterLabel = filterOptions[0].label;
        }

        this.setData({ seasons, filterOptions, selectedFilter, selectedFilterLabel });

        if (selectedFilter) {
          this.loadLeaderboard();
        } else {
          this.setData({ loading: false });
        }
      })
      .catch(err => {
        console.error(err);
        this.setData({ loading: false });
        wx.showToast({ title: this.data.i18n.toast_failed_load_leaderboard, icon: 'none' });
      });
  },

  onSeasonChange(e) {
    const index = e.detail.value;
    const option = this.data.filterOptions[index];
    if (!option) return;

    this.setData({
      selectedFilter: option.value,
      selectedFilterLabel: option.label,
      season: null,
      leaderboard: []
    });

    this.loadLeaderboard();
  },

  onPullDownRefresh() {
    this.loadLeaderboard().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  navigateToPlayerStats(e) {
    const { playerId, playerName } = e.currentTarget.dataset;
    if (playerId) {
      wx.navigateTo({
        url: `/pages/stats/stats?playerId=${playerId}&playerName=${encodeURIComponent(playerName || '')}`
      });
    }
  },

  loadLeaderboard() {
    this.setData({ loading: true });
    const params = { all: true };
    if (this.data.selectedFilter) {
      params.seasonId = this.data.selectedFilter;
    }
    return callFunction('getSeasonStats', params)
      .then(res => {
        const season = res.result.season || null;
        const statsList = res.result.statsList || [];

        if (season) {
          wx.setNavigationBarTitle({ title: season.name || this.data.i18n.leaderboard_title });
        }

        const leaderboard = statsList.map((s, index) => {
          const matchesPlayed = s.matchesPlayed || 0;
          const wins = s.wins || 0;
          const winRate = matchesPlayed > 0 ? Math.round(wins / matchesPlayed * 100) : 0;
          return {
            rank: index + 1,
            playerId: s.playerId,
            name: s.playerName || 'Unknown',
            points: s.points || 0,
            matchesPlayed,
            losses: s.losses || 0,
            winRate: winRate + '%',
            perfectEventCount: s.perfectEventCount || 0
          };
        });

        this.setData({ season, leaderboard, loading: false });
      })
      .catch(err => {
        console.error(err);
        this.setData({ loading: false });
        wx.showToast({ title: this.data.i18n.toast_failed_load_leaderboard, icon: 'none' });
      });
  },
  onShareAppMessage() {
    const season = this.data.season;
    const seasonId = this.data.selectedFilter;
    return {
      title: season ? season.name : (this.data.i18n.leaderboard_title || 'Leaderboard'),
      path: seasonId
        ? `/pages/leaderboard/leaderboard?seasonId=${seasonId}`
        : '/pages/leaderboard/leaderboard',
      imageUrl: '/images/share.jpg'
    };
  },
  onShareTimeline() {
    const season = this.data.season;
    const seasonId = this.data.selectedFilter;
    return {
      title: season ? season.name : (this.data.i18n.leaderboard_title || 'Leaderboard'),
      query: seasonId
        ? `targetPage=leaderboard&seasonId=${seasonId}`
        : 'targetPage=leaderboard'
    };
  }
});
