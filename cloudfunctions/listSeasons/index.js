const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const SETTINGS_ID = 'core';

async function getSettings() {
  const res = await db.collection('settings').doc(SETTINGS_ID).get().catch(() => null);
  return res && res.data ? res.data : null;
}

exports.main = async (event, context) => {
  const settings = await getSettings();
  const res = await db.collection('seasons').orderBy('startDate', 'desc').get();
  return {
    seasons: res.data || [],
    activeSeasonId: settings ? settings.activeSeasonId : null
  };
};
