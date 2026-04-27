const Notification = require('../models/notificationModel');
const { getIO } = require('../socket');

async function notifyUser({ userId, type, title, body, meta = null }) {
  if (!userId) return;

  const notificationId = await Notification.createNotification({
    userId,
    type,
    title,
    body,
    meta
  });

  try {
    getIO().to(`user_${userId}`).emit('notification:new', {
      id: notificationId,
      type,
      title,
      body,
      meta,
      is_read: 0,
      created_at: new Date().toISOString()
    });
  } catch (e) {}
}

module.exports = {
  notifyUser
};
