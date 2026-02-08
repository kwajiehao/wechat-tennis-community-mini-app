// ABOUTME: Cloud function wrapper that routes to local handlers in dev mode.
// ABOUTME: Provides initCloud() and callFunction() for cloud or local execution.

const app = getApp();

function initCloud() {
  if (app.globalData.devMode) {
    console.log('[DEV MODE] Using local handlers instead of cloud');
    return true;
  }
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
  if (app.globalData.devMode) {
    const { handleLocal } = require('./local-handlers');
    return handleLocal(name, data);
  }
  return wx.cloud.callFunction({
    name,
    data: data || {}
  });
}

module.exports = {
  initCloud,
  callFunction
};
