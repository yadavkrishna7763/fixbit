const Notification = require('../models/notificationModel');
const { ok, fail } = require('../utils/apiResponse');

async function getMyNotifications(req, res) {
  const limit = Number(req.query.limit) || 30;
  const notifications = await Notification.listForUser(req.user.id, Math.min(limit, 100));
  return ok(res, 'Notifications loaded', { notifications });
}

async function markNotificationRead(req, res) {
  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return fail(res, 400, 'Invalid notification id');
  }

  const affectedRows = await Notification.markRead(notificationId, req.user.id);
  if (!affectedRows) {
    return fail(res, 404, 'Notification not found');
  }

  return ok(res, 'Notification marked as read');
}

async function markAllNotificationsRead(req, res) {
  await Notification.markAllRead(req.user.id);
  return ok(res, 'All notifications marked as read');
}

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
