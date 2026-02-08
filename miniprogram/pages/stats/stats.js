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
    this.fetchStats();
    this.fetchSeasonStats();
  },
  onShow() {
    this.loadI18n();
  },
  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },
  fetchStats() {
    callFunction('getStats', { mine: true })
      .then(res => {
        this.setData({ stats: res.result.stats || null });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_stats, icon: 'none' });
      });
  },
  fetchSeasonStats() {
    callFunction('getSeasonStats', { mine: true })
      .then(res => {
        this.setData({
          seasonStats: res.result.stats || null,
          season: res.result.season || null
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_season_stats, icon: 'none' });
      });
  }
});
