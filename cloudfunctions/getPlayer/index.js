const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  console.log('[getPlayer] start, OPENID:', OPENID);
  try {
    const res = await db.collection('players').where({ wechatOpenId: OPENID }).get();
    console.log('[getPlayer] success, found:', res.data.length, 'players');
    return { player: res.data[0] || null };
  } catch (err) {
    console.error('[getPlayer] failed querying players collection:', err);
    throw err;
  }
};
