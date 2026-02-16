// ABOUTME: WeChat Mini Program entry point with cloud initialization.
// ABOUTME: Configuration loaded from config.js (gitignored).

const config = require('./config.js');

App({
  globalData: {
    envId: config.envId
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error("wx.cloud not available. Please use WeChat DevTools 2.2.3+.");
      return;
    }
    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });

    // Privacy check - log detected privacy requirements
    wx.getPrivacySetting({
      success(res) {
        console.log('=== PRIVACY CHECK ===');
        console.log('needAuthorization:', res.needAuthorization);
        console.log('privacyContractName:', res.privacyContractName);
        console.log('Full response:', JSON.stringify(res, null, 2));
      },
      fail(err) {
        console.log('=== PRIVACY CHECK FAILED ===', err);
      }
    });
  }
});
