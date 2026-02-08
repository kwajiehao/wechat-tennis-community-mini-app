// ABOUTME: Cloud function to check if the current user is an admin.
// ABOUTME: Returns isAdmin boolean based on settings.adminOpenIds.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const SETTINGS_ID = 'core';

async function getSettings() {
  const res = await db.collection('settings').doc(SETTINGS_ID).get().catch(() => null);
  return res && res.data ? res.data : null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const settings = await getSettings();

  if (!settings || !settings.adminOpenIds) {
    return { isAdmin: false };
  }

  return { isAdmin: settings.adminOpenIds.includes(OPENID) };
};
