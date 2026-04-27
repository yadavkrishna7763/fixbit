const { fail } = require('../utils/apiResponse');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, 'Access denied');
    }

    next();
  };
}

module.exports = requireRole;
