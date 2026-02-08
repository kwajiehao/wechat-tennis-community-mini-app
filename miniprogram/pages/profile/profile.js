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
    ntrp: '',
    ntrpOptions: ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0'],
    ntrpIndex: -1
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
          const ntrpStr = player.ntrp ? String(player.ntrp) : '';
          const ntrpIndex = this.data.ntrpOptions.indexOf(ntrpStr);
          this.setData({
            player,
            isNewUser: false,
            name: player.name || '',
            gender: gender.toUpperCase(),
            genderIndex: this.data.genderCodes.indexOf(gender.toUpperCase()),
            ntrp: ntrpStr,
            ntrpIndex: ntrpIndex
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
  onNtrpChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      ntrpIndex: index,
      ntrp: this.data.ntrpOptions[index]
    });
  },
  saveProfile() {
    const ntrpValue = parseFloat(this.data.ntrp);
    callFunction('upsertPlayer', {
      name: this.data.name,
      gender: this.data.gender,
      ntrp: Number.isNaN(ntrpValue) ? null : ntrpValue
    })
      .then(res => {
        this.setData({ player: res.result.player, isNewUser: false });
        wx.showToast({ title: this.data.i18n.toast_saved, icon: 'success' });
      })
      .catch(err => {
        console.error(err);
        wx.showToast({ title: err.message || 'Save failed', icon: 'none' });
      });
  }
});
