// ABOUTME: Home page showing upcoming events and navigation to other sections.
// ABOUTME: Entry point for the tennis league mini program.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    events: [],
    completedEvents: [],
    loading: false,
    hasProfile: false,
    playerId: null,
    dataLoaded: false,
    isAdmin: false
  },
  onLoad() {
    initCloud();
    i18n.init();
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
    return Promise.all([
      callFunction('listEvents', {}),
      callFunction('listMatches', { mine: true })
    ])
      .then(([eventsRes, matchesRes]) => {
        const allEvents = eventsRes.result.events || [];
        const myMatches = matchesRes.result.matches || [];

        // Get event IDs where player participated
        const participatedEventIds = new Set(
          myMatches.map(m => m.eventId).filter(Boolean)
        );

        // Split into active and completed events
        const activeEvents = allEvents.filter(e => e.status !== 'completed');
        const completedEvents = allEvents
          .filter(e => e.status === 'completed' && participatedEventIds.has(e._id))
          .sort((a, b) => (b.completedAt || b.date || '').localeCompare(a.completedAt || a.date || ''));

        this.setData({
          events: activeEvents,
          completedEvents
        });
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
