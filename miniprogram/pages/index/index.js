// ABOUTME: Home page showing upcoming events and navigation to other sections.
// ABOUTME: Entry point for the tennis league mini program.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    events: [],
    loading: false,
    hasProfile: false,
    playerId: null,
    dataLoaded: false,
    isAdmin: false
  },
  onLoad(options) {
    initCloud();
    i18n.init();
    // Handle redirect from 朋友圈 sharing
    if (options.targetPage) {
      const page = options.targetPage;
      const queryParts = [];
      for (const [key, value] of Object.entries(options)) {
        if (key !== 'targetPage') {
          queryParts.push(`${key}=${encodeURIComponent(value)}`);
        }
      }
      const queryStr = queryParts.length ? '?' + queryParts.join('&') : '';
      wx.redirectTo({
        url: `/pages/${page}/${page}${queryStr}`,
        fail: () => {
          // Redirect not available (e.g., 朋友圈 single page mode)
          this.loadI18n();
          this.loadInitialData();
        }
      });
      return;
    }
    this.loadI18n();
    this.loadInitialData();
  },
  onShow() {
    this.loadI18n();
    // Only reload if we've already loaded once (returning to page)
    if (this.data.dataLoaded) {
      this.loadInitialData();
    }
  },
  loadInitialData() {
    this.setData({ loading: true });
    Promise.all([
      this.fetchProfile(),
      this.fetchEventsData(),
      this.fetchAdminStatus()
    ]).finally(() => {
      this.setData({ loading: false, dataLoaded: true });
    });
  },
  fetchAdminStatus() {
    return callFunction('checkAdmin', {})
      .then(res => {
        this.setData({ isAdmin: res.result.isAdmin === true });
      })
      .catch(() => {
        this.setData({ isAdmin: false });
      });
  },
  fetchProfile() {
    return callFunction('getPlayer', {})
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
    Promise.all([
      this.fetchProfile(),
      this.fetchEventsData()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },
  fetchEventsData() {
    return callFunction('listEvents', { status: ['open', 'in_progress'] })
      .then(eventsRes => {
        this.setData({ events: eventsRes.result.events || [] });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: this.data.i18n.toast_failed_load_events, icon: 'none' });
      });
  },
  goEvent(e) {
    const eventId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/event/event?eventId=${eventId}` });
  },
  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },
  goLeaderboard() {
    wx.navigateTo({ url: '/pages/leaderboard/leaderboard' });
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
  },
  onShareAppMessage() {
    return {
      title: this.data.i18n.app_title || 'Tennis Community',
      path: '/pages/index/index',
      imageUrl: '/images/share.jpg'
    };
  },
  onShareTimeline() {
    return {
      title: this.data.i18n.app_title || 'Tennis Community'
    };
  }
});
