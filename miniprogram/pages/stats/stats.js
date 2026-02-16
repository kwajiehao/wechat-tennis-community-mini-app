// ABOUTME: Stats page showing player season statistics with season filter.
// ABOUTME: Displays wins, losses, points, win rate (as %), and event breakdown.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    selectedFilter: '',
    selectedFilterLabel: '',
    seasonWinRate: '0%',
    filterOptions: [],
    seasons: [],
    seasonStats: null,
    eventBreakdown: [],
    isLoading: true
  },

  onLoad(options) {
    initCloud();
    this.loadI18n();
    if (options.playerId) {
      this._playerId = options.playerId;
      this._playerName = options.playerName ? decodeURIComponent(options.playerName) : '';
      if (this._playerName) {
        wx.setNavigationBarTitle({ title: this._playerName });
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

    const promises = [callFunction('listSeasons', {})];

    // Resolve own player info for sharing when viewing own stats
    if (!this._playerId) {
      promises.push(callFunction('getPlayer', {}));
    }

    Promise.all(promises)
      .then(([seasonsRes, playerRes]) => {
        if (playerRes) {
          const player = playerRes.result.player;
          if (player) {
            this._playerId = player._id;
            this._playerName = player.name || '';
          }
        }

        const seasons = seasonsRes.result.seasons || [];
        const activeSeasonId = seasonsRes.result.activeSeasonId;

        // Sort seasons by start date descending (newest first)
        const sortedSeasons = seasons.slice().sort((a, b) => {
          return (b.startDate || '').localeCompare(a.startDate || '');
        });

        const filterOptions = sortedSeasons.map(season => ({
          value: season._id,
          label: season.name
        }));

        // Default to active season, or first season
        let selectedFilter = '';
        let selectedFilterLabel = '';
        if (activeSeasonId) {
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

        this.setData({
          seasons,
          filterOptions,
          selectedFilter,
          selectedFilterLabel,
          isLoading: false
        });

        if (selectedFilter) {
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

    this.loadSeasonStats(option.value);
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

  navigateToEvent(e) {
    const eventId = e.currentTarget.dataset.eventId;
    if (eventId) {
      wx.navigateTo({ url: `/pages/event/event?eventId=${eventId}` });
    }
  },

  _getSharePath() {
    if (!this._playerId) return '/pages/index/index';
    return `/pages/stats/stats?playerId=${this._playerId}&playerName=${encodeURIComponent(this._playerName || '')}`;
  },

  onShareAppMessage() {
    return {
      title: this._playerName || this.data.i18n.stats_title || 'Player Stats',
      path: this._getSharePath()
    };
  },
  onShareTimeline() {
    const query = this._playerId
      ? `targetPage=stats&playerId=${this._playerId}&playerName=${encodeURIComponent(this._playerName || '')}`
      : '';
    return {
      title: this._playerName || this.data.i18n.stats_title || 'Player Stats',
      query
    };
  }
});
