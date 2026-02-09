// ABOUTME: Leaderboard page showing player rankings for the active season.
// ABOUTME: Displays games played, wins, losses, and points in a table format.

const { callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    season: null,
    leaderboard: [],
    loading: true
  },

  onLoad() {
    this.loadI18n();
    this.loadLeaderboard();
  },

  onShow() {
    this.loadI18n();
  },

  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },

  onPullDownRefresh() {
    this.loadLeaderboard().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  loadLeaderboard() {
    this.setData({ loading: true });
    return callFunction('getSeasonStats', { all: true })
      .then(res => {
        const season = res.result.season || null;
        const statsList = res.result.statsList || [];

        if (season) {
          wx.setNavigationBarTitle({ title: season.name || this.data.i18n.leaderboard_title });
        }

        console.log('statsList from getSeasonStats:', JSON.stringify(statsList));
        const leaderboard = statsList.map((s, index) => ({
          rank: index + 1,
          name: s.playerName || 'Unknown',
          matchesPlayed: s.matchesPlayed || 0,
          wins: s.wins || 0,
          losses: s.losses || 0,
          points: s.points || 0
        }));
        console.log('leaderboard data:', JSON.stringify(leaderboard));

        this.setData({ season, leaderboard, loading: false });
      })
      .catch(err => {
        console.error(err);
        this.setData({ loading: false });
        wx.showToast({ title: this.data.i18n.toast_failed_load_leaderboard, icon: 'none' });
      });
  }
});
