// ABOUTME: Home page showing upcoming events and navigation to other sections.
// ABOUTME: Entry point for the tennis league mini program.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    events: [],
    loading: false,
    hasProfile: false
  },
  onLoad() {
    initCloud();
    i18n.init();
    this.loadI18n();
    this.fetchEvents();
    this.checkProfile();
  },
  onShow() {
    this.loadI18n();
    this.checkProfile();
  },
  checkProfile() {
    callFunction('getPlayer', {})
      .then(res => {
        const player = res.result.player || null;
        this.setData({ hasProfile: !!player });
      })
      .catch(() => {
        this.setData({ hasProfile: false });
      });
  },
  loadI18n() {
    this.setData({ i18n: i18n.getStrings() });
  },
  onPullDownRefresh() {
    this.fetchEvents().finally(() => wx.stopPullDownRefresh());
  },
  fetchEvents() {
    this.setData({ loading: true });
    return callFunction('listEvents', {})
      .then(res => {
        this.setData({ events: res.result.events || [] });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: 'Failed to load events', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
  goEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/event/event?eventId=${eventId}` });
  },
  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },
  goMatches() {
    wx.navigateTo({ url: '/pages/matches/matches' });
  },
  goStats() {
    wx.navigateTo({ url: '/pages/stats/stats' });
  },
  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' });
  },
  goPlayers() {
    wx.navigateTo({ url: '/pages/players/players' });
  },
  goSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' });
  }
});
