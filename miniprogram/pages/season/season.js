// ABOUTME: Season details page showing leaderboard and match history.
// ABOUTME: Displays player rankings sorted by wins and recent/all matches.

const { callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

function getMatchTypes() {
  const strs = i18n.getStrings();
  return [
    { value: 'singles', label: strs.match_singles },
    { value: 'mens_singles', label: strs.match_mens_singles },
    { value: 'womens_singles', label: strs.match_womens_singles },
    { value: 'mens_doubles', label: strs.match_mens_doubles },
    { value: 'womens_doubles', label: strs.match_womens_doubles },
    { value: 'mixed_doubles', label: strs.match_mixed_doubles }
  ];
}

Page({
  data: {
    i18n: {},
    seasonId: '',
    seasonName: '',
    events: [],
    recentMatches: [],
    allMatches: [],
    displayedMatches: [],
    showAllMatches: false,
    matchTypes: []
  },

  onLoad(options) {
    this.loadI18n();
    if (options.seasonId) {
      this.setData({ seasonId: options.seasonId });
      if (options.seasonName) {
        this.setData({ seasonName: decodeURIComponent(options.seasonName) });
        wx.setNavigationBarTitle({ title: decodeURIComponent(options.seasonName) });
      }
      this.loadSeasonData();
    }
  },

  loadI18n() {
    this.setData({
      i18n: i18n.getStrings(),
      matchTypes: getMatchTypes()
    });
  },

  loadSeasonData() {
    this.fetchEvents();
    this.loadMatches();
  },

  fetchEvents() {
    callFunction('listEvents', { seasonId: this.data.seasonId })
      .then(res => {
        const events = (res.result.events || []).sort((a, b) => {
          const dateA = a.createdAt || a.date || '';
          const dateB = b.createdAt || b.date || '';
          return dateB.localeCompare(dateA);
        });
        this.setData({ events });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_events, icon: 'none' });
      });
  },

  goToEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/event/event?eventId=${eventId}`
    });
  },

  goToLeaderboard() {
    const seasonId = this.data.seasonId;
    const seasonName = encodeURIComponent(this.data.seasonName);
    wx.navigateTo({
      url: `/pages/leaderboard/leaderboard?seasonId=${seasonId}&seasonName=${seasonName}`
    });
  },

  loadMatches() {
    const seasonId = this.data.seasonId;
    const matchTypes = this.data.matchTypes;

    callFunction('listMatches', { seasonId })
      .then(res => {
        const matches = (res.result.matches || []).map(m => {
          const typeObj = matchTypes.find(t => t.value === m.matchType);
          return {
            ...m,
            matchTypeLabel: typeObj ? typeObj.label : m.matchType
          };
        });

        const sortedMatches = matches.sort((a, b) => {
          const dateA = a.completedAt || a.generatedAt || '';
          const dateB = b.completedAt || b.generatedAt || '';
          return dateB.localeCompare(dateA);
        });

        const recentMatches = sortedMatches.slice(0, 5);
        this.setData({
          allMatches: sortedMatches,
          recentMatches: recentMatches,
          displayedMatches: recentMatches
        });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_matches, icon: 'none' });
      });
  },

  toggleShowAllMatches() {
    const showAll = !this.data.showAllMatches;
    this.setData({
      showAllMatches: showAll,
      displayedMatches: showAll ? this.data.allMatches : this.data.recentMatches
    });
  },
  onShareAppMessage() {
    return {
      title: this.data.seasonName || 'Tennis Community',
      path: `/pages/season/season?seasonId=${this.data.seasonId}&seasonName=${encodeURIComponent(this.data.seasonName)}`
    };
  },
  onShareTimeline() {
    return {
      title: this.data.seasonName || 'Tennis Community',
      query: `targetPage=season&seasonId=${this.data.seasonId}&seasonName=${encodeURIComponent(this.data.seasonName)}`
    };
  }
});
