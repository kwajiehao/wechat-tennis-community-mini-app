const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { playerId, mine } = event;

  let id = playerId;
  if (mine || !id) {
    const res = await db.collection('players').where({ wechatOpenId: OPENID }).get();
    id = res.data[0]?._id;
  }
  if (!id) {
    return { stats: null };
  }

  const statsRes = await db.collection('stats').doc(id).get().catch(() => null);
  return { stats: statsRes && statsRes.data ? statsRes.data : null };
};
