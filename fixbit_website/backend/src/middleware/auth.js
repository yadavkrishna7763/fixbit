const jwt = require('jsonwebtoken');
const { fail } = require('../utils/apiResponse');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, 401, 'No token provided');
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return fail(res, 500, 'JWT secret is not configured');
    }

    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return fail(res, 401, 'Invalid token');
  }
};
