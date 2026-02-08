// ABOUTME: Stats page showing player statistics for current season and all time.
// ABOUTME: Displays wins, losses, points, and win rate.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    stats: null,
    seasonStats: null,
    season: null
  },
  onLoad() {
    initCloud();
    this.loadI18n();
    this.fetchAllStats();
  },
  onShow() {
    this.loadI18n();
  },
  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },
  fetchAllStats() {
    Promise.all([
      callFunction('getStats', { mine: true }),
      callFunction('getSeasonStats', { mine: true })
    ])
      .then(([statsRes, seasonStatsRes]) => {
        this.setData({
          stats: statsRes.result.stats || null,
          seasonStats: seasonStatsRes.result.stats || null,
          season: seasonStatsRes.result.season || null
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_stats, icon: 'none' });
      });
  }
});
