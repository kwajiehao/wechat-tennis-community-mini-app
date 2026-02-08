const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const res = await db.collection('players').where({ wechatOpenId: OPENID }).get();
  return { player: res.data[0] || null };
};
