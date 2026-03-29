// ABOUTME: Profile page for viewing and editing player information.
// ABOUTME: Supports WeChat nickname input for registration.

const { initCloud, callFunction } = require('../../utils/cloud');
const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    player: null,
    isNewUser: true,
    name: '',
    gender: 'M',
    genderCodes: ['M', 'F'],
    genderLabels: [],
    genderIndex: 0,
    dltrDisplay: ''
  },
  onLoad() {
    initCloud();
    this.loadI18n();
    this.fetchProfile();
  },
  onShow() {
    this.loadI18n();
  },
  loadI18n() {
    const strs = i18n.getStrings();
    this.setData({
      i18n: strs,
      genderLabels: [strs.gender_male, strs.gender_female]
    });
  },
  fetchProfile() {
    callFunction('getPlayer', {})
      .then(res => {
        const player = res.result.player || null;
        if (player) {
          const gender = player.gender || 'M';
          const strs = i18n.getStrings();
          const dltrDisplay = player.utr != null ? String(player.utr) : strs.profile_unrated;
          this.setData({
            player,
            isNewUser: false,
            name: player.name || '',
            gender: gender.toUpperCase(),
            genderIndex: this.data.genderCodes.indexOf(gender.toUpperCase()),
            dltrDisplay
          });
        } else {
          this.setData({ isNewUser: true });
        }
      })
      .catch(err => {
        console.error(err);
        this.setData({ isNewUser: true });
      });
  },
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onGenderChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      genderIndex: index,
      gender: this.data.genderCodes[index]
    });
  },
  saveProfile() {
    callFunction('upsertPlayer', {
      name: this.data.name,
      gender: this.data.gender
    })
      .then(res => {
        this.setData({ player: res.result.player, isNewUser: false });
        wx.showToast({ title: this.data.i18n.toast_saved, icon: 'success' });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Save failed', icon: 'none' });
      });
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
