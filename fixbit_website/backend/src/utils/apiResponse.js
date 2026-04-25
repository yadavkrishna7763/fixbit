function mergeData(payload, data) {
  if (data && !Array.isArray(data) && typeof data === 'object') {
    return { ...payload, ...data };
  }

  return payload;
}

function ok(res, message = 'OK', data = {}, status = 200) {
  const payload = {
    success: true,
    message,
    data
  };

  return res.status(status).json(mergeData(payload, data));
}

function fail(res, status = 500, message = 'Internal Server Error', data = null) {
  return res.status(status).json({
    success: false,
    message,
    data
  });
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

module.exports = {
  ok,
  fail,
  asyncHandler
};
