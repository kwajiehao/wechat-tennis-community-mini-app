// ABOUTME: Settings page for app configuration.
// ABOUTME: Includes language switcher for i18n support.

const i18n = require('../../utils/i18n');

Page({
  data: {
    i18n: {},
    currentLang: 'en'
  },
  onLoad() {
    this.loadI18n();
  },
  onShow() {
    this.loadI18n();
  },
  loadI18n() {
    this.setData({
      i18n: i18n.getStrings(),
      currentLang: i18n.getLang()
    });
  },
  switchLanguage() {
    const newLang = this.data.currentLang === 'en' ? 'zh' : 'en';
    i18n.setLang(newLang);
    this.loadI18n();
    wx.showToast({ title: newLang === 'zh' ? '已切换到中文' : 'Switched to English', icon: 'none' });
  }
});
