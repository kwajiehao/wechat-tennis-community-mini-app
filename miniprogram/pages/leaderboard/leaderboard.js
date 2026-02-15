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
    return callFunction('getSeasonStats', { all: true })
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
            championCount: s.championCount || 0
          };
        });

        this.setData({ season, leaderboard, loading: false });
      })
      .catch(err => {
        console.error(err);
        this.setData({ loading: false });
        wx.showToast({ title: this.data.i18n.toast_failed_load_leaderboard, icon: 'none' });
      });
  }
});
