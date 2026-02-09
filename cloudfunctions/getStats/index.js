// ABOUTME: Retrieves overall player statistics from stats collection.
// ABOUTME: Also returns event breakdown with placement info across all seasons.

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
  const stats = statsRes && statsRes.data ? statsRes.data : null;

  // Get event breakdown across all completed events
  const eventsRes = await db.collection('events')
    .where({ status: 'completed' })
    .field({ _id: true, title: true, date: true, playerPoints: true, leaderboard: true })
    .get();
  const completedEvents = eventsRes.data || [];

  const eventBreakdown = [];
  for (const evt of completedEvents) {
    const evtPoints = evt.playerPoints || {};
    const pts = evtPoints[id] || 0;
    if (pts > 0) {
      // Find player's placement in the leaderboard
      let placement = null;
      if (evt.leaderboard && evt.leaderboard.rankings) {
        const playerRanking = evt.leaderboard.rankings.find(r => r.playerId === id);
        if (playerRanking && playerRanking.rank <= 2) {
          placement = playerRanking.rank;
        }
      }
      eventBreakdown.push({
        eventId: evt._id,
        eventTitle: evt.title,
        eventDate: evt.date,
        points: pts,
        placement
      });
    }
  }

  // Sort events by date descending
  eventBreakdown.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));

  return {
    stats: stats ? { ...stats, eventBreakdown } : { eventBreakdown }
  };
};
