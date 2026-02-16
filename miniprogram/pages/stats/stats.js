// ABOUTME: Stats page showing player statistics with filter for overall vs specific season.
// ABOUTME: Displays wins, losses, points, win rate (as %), and event breakdown for seasons.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    selectedFilter: 'overall',
    selectedFilterLabel: '',
    formattedWinRate: '0%',
    seasonWinRate: '0%',
    filterOptions: [],
    seasons: [],
    stats: null,
    seasonStats: null,
    eventBreakdown: [],
    overallEventBreakdown: [],
    isLoading: true
  },

  onLoad(options) {
    initCloud();
    this.loadI18n();
    if (options.playerId) {
      this._playerId = options.playerId;
      const playerName = options.playerName ? decodeURIComponent(options.playerName) : '';
      if (playerName) {
        wx.setNavigationBarTitle({ title: playerName });
      }
    }
    this.loadData();
  },

  onShow() {
    this.loadI18n();
  },

  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },

  loadData() {
    this.setData({ isLoading: true });

    const statsParams = this._playerId ? { playerId: this._playerId } : { mine: true };
    Promise.all([
      callFunction('listSeasons', {}),
      callFunction('getStats', statsParams)
    ])
      .then(([seasonsRes, statsRes]) => {
        const seasons = seasonsRes.result.seasons || [];
        const activeSeasonId = seasonsRes.result.activeSeasonId;
        const stats = statsRes.result.stats || null;

        // Build filter options: Overall + all seasons
        const strs = i18n.getStrings();
        const filterOptions = [
          { value: 'overall', label: strs.stats_overall || 'Overall' }
        ];

        // Sort seasons by start date descending (newest first)
        const sortedSeasons = seasons.slice().sort((a, b) => {
          return (b.startDate || '').localeCompare(a.startDate || '');
        });

        for (const season of sortedSeasons) {
          filterOptions.push({
            value: season._id,
            label: season.name
          });
        }

        // Determine initial selection: active season or 'overall'
        let selectedFilter = 'overall';
        let selectedFilterLabel = filterOptions[0].label;
        if (activeSeasonId) {
          const activeOption = filterOptions.find(o => o.value === activeSeasonId);
          if (activeOption) {
            selectedFilter = activeSeasonId;
            selectedFilterLabel = activeOption.label;
          }
        }

        // Format win rate for display
        const formattedWinRate = this.formatWinRate(stats ? stats.winRate : null);

        // Get overall event breakdown from stats
        const overallEventBreakdown = stats && stats.eventBreakdown ? stats.eventBreakdown : [];

        this.setData({
          seasons,
          filterOptions,
          stats,
          selectedFilter,
          selectedFilterLabel,
          formattedWinRate,
          overallEventBreakdown,
          isLoading: false
        });

        // Load season stats if we defaulted to active season
        if (selectedFilter !== 'overall') {
          this.loadSeasonStats(selectedFilter);
        }
      })
      .catch(err => {
        console.error(err);
        this.setData({ isLoading: false });
        wx.showToast({ title: this.data.i18n.toast_failed_load_stats, icon: 'none' });
      });
  },

  onFilterChange(e) {
    const index = e.detail.value;
    const option = this.data.filterOptions[index];
    if (!option) return;

    this.setData({
      selectedFilter: option.value,
      selectedFilterLabel: option.label,
      seasonStats: null,
      eventBreakdown: []
    });

    if (option.value !== 'overall') {
      this.loadSeasonStats(option.value);
    }
  },

  loadSeasonStats(seasonId) {
    const params = this._playerId ? { seasonId, playerId: this._playerId } : { seasonId, mine: true };
    callFunction('getSeasonStats', params)
      .then(res => {
        const stats = res.result.stats || null;
        const eventBreakdown = stats ? (stats.eventBreakdown || []) : [];

        // Compute win rate for season
        let seasonWinRate = '0%';
        if (stats && stats.matchesPlayed > 0) {
          const winRateDecimal = stats.wins / stats.matchesPlayed;
          seasonWinRate = Math.round(winRateDecimal * 100) + '%';
        }

        this.setData({
          seasonStats: stats,
          eventBreakdown,
          seasonWinRate
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_season_stats, icon: 'none' });
      });
  },

  getFilterLabel() {
    const option = this.data.filterOptions.find(o => o.value === this.data.selectedFilter);
    return option ? option.label : '';
  },

  formatWinRate(winRate) {
    if (winRate === null || winRate === undefined) return '0%';
    // winRate is stored as decimal (0 to 1), convert to percentage
    const pct = Math.round(winRate * 100);
    return pct + '%';
  },

  navigateToEvent(e) {
    const eventId = e.currentTarget.dataset.eventId;
    if (eventId) {
      wx.navigateTo({ url: `/pages/event/event?eventId=${eventId}` });
    }
  },
  onShareAppMessage() {
    return {
      title: this.data.i18n.app_title || 'Tennis Community',
      path: '/pages/index/index'
    };
  },
  onShareTimeline() {
    return {
      title: this.data.i18n.app_title || 'Tennis Community'
    };
  }
});
