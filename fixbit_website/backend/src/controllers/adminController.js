const User = require('../models/userModel');
const Request = require('../models/requestModel');
const { ok, fail } = require('../utils/apiResponse');

async function getUsers(req, res) {
  const users = await User.listUsers();
  return ok(res, 'Users loaded', { users });
}

async function toggleBan(req, res) {
  const userId = Number(req.params.id);
  const banned = Boolean(req.body.banned);

  if (!Number.isInteger(userId) || userId <= 0) {
    return fail(res, 400, 'Invalid user id');
  }

  if (userId === Number(req.user.id)) {
    return fail(res, 400, 'You cannot ban your own admin account');
  }

  await User.setBanned(userId, banned);
  return ok(res, `User ${banned ? 'banned' : 'unbanned'} successfully`);
}

async function getRequests(req, res) {
  const requests = await Request.listAllForAdmin();
  return ok(res, 'Requests loaded', { requests });
}

async function deleteRequest(req, res) {
  const requestId = Number(req.params.id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail(res, 400, 'Invalid request id');
  }

  await Request.deleteById(requestId);
  return ok(res, 'Request deleted');
}

module.exports = {
  getUsers,
  toggleBan,
  getRequests,
  deleteRequest
};
