// ABOUTME: Matches page showing all matches for the current player.
// ABOUTME: Displays match type, teams, status, and event info.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    matches: []
  },
  onLoad() {
    initCloud();
    this.loadI18n();
    this.fetchMatches();
  },
  onShow() {
    this.loadI18n();
  },
  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },
  fetchMatches() {
    callFunction('listMatches', { mine: true })
      .then(res => {
        this.setData({ matches: res.result.matches || [] });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load matches', icon: 'none' });
      });
  }
});
