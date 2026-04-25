const User = require('../models/userModel');
const { fail } = require('../utils/apiResponse');

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || 'admin@fixbit.com,admin@gmail.com,')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

module.exports = async (req, res, next) => {
  try {
    const user = await User.findSafeById(req.user.id);

    if (!user || !user.email || !getAdminEmails().includes(user.email.toLowerCase())) {
      return fail(res, 403, 'Admin access only');
    }

    req.admin = user;
    next();
  } catch (err) {
    next(err);
  }
};
