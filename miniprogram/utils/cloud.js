// ABOUTME: Cloud function wrapper for WeChat CloudBase.
// ABOUTME: Provides initCloud() and callFunction() for cloud execution.

const app = getApp();

function initCloud() {
  if (!wx.cloud) {
    wx.showToast({ title: "Cloud not available", icon: "none" });
    return false;
  }
  wx.cloud.init({
    env: app.globalData.envId,
    traceUser: true
  });
  return true;
}

function callFunction(name, data) {
  return wx.cloud.callFunction({
    name,
    data: data || {}
  });
}

module.exports = {
  initCloud,
  callFunction
};
