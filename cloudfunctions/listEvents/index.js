const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { eventId, status, seasonId } = event;
  console.log('[listEvents] start, params:', JSON.stringify({ eventId, status, seasonId }));

  try {
    if (eventId) {
      const res = await db.collection('events').doc(eventId).get().catch(() => ({ data: null }));
      console.log('[listEvents] single event lookup, found:', !!res.data);
      return { events: res.data ? [res.data] : [] };
    }

    let query = db.collection('events');
    const filter = {};
    if (Array.isArray(status)) {
      filter.status = db.command.in(status);
    } else if (status) {
      filter.status = status;
    }
    if (seasonId) {
      filter.seasonId = seasonId;
    }
    if (Object.keys(filter).length > 0) {
      query = query.where(filter);
    }

    console.log('[listEvents] trying orderBy query...');
    const res = await query.orderBy('date', 'asc').get();
    console.log('[listEvents] success, found:', (res.data || []).length, 'events');
    return { events: res.data || [] };
  } catch (err) {
    console.error('[listEvents] failed:', err);
    throw err;
  }
};
