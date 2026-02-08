const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { eventId, status, seasonId } = event;

  if (eventId) {
    const res = await db.collection('events').doc(eventId).get().catch(() => ({ data: null }));
    return { events: res.data ? [res.data] : [] };
  }

  let query = db.collection('events');
  const filter = {};
  if (status) {
    filter.status = status;
  }
  if (seasonId) {
    filter.seasonId = seasonId;
  }
  if (Object.keys(filter).length > 0) {
    query = query.where(filter);
  }

  const res = await query.orderBy('date', 'asc').get();
  return { events: res.data || [] };
};
