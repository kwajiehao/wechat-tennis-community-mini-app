// ABOUTME: Allows a player to withdraw from an event they previously signed up for.
// ABOUTME: Removes or updates the signup record to status 'withdrawn'.

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function getPlayerByOpenId(openid) {
  const res = await db.collection('players').where({ wechatOpenId: openid }).get();
  return res.data[0] || null;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { eventId } = event;

  if (!eventId) {
    throw new Error('MISSING_EVENT_ID');
  }

  // Check event status - cannot withdraw once in_progress or completed
  const eventDoc = await db.collection('events').doc(eventId).get();
  if (!eventDoc.data) {
    throw new Error('EVENT_NOT_FOUND');
  }
  const eventStatus = eventDoc.data.status;
  if (eventStatus === 'in_progress' || eventStatus === 'completed') {
    throw new Error('EVENT_NOT_OPEN');
  }

  const player = await getPlayerByOpenId(OPENID);
  if (!player) {
    throw new Error('PLAYER_NOT_FOUND');
  }

  const existing = await db.collection('signups')
    .where({ eventId, playerId: player._id })
    .get();

  if (existing.data.length === 0) {
    throw new Error('NOT_SIGNED_UP');
  }

  const signupId = existing.data[0]._id;
  await db.collection('signups').doc(signupId).update({
    data: {
      status: 'withdrawn',
      updatedAt: new Date().toISOString()
    }
  });

  return { success: true };
};
