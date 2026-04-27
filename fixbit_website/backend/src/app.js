const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const shopRoutes = require('./routes/shops');
const requestRoutes = require('./routes/requests');
const responseRoutes = require('./routes/responses');
const reviewRoutes = require('./routes/reviews');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const { fail } = require('./utils/apiResponse');
const { uploadRoot } = require('./utils/uploads');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false
}));

app.use('/uploads', express.static(uploadRoot, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FixBit API is running',
    data: {
      version: '2.1.0'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Healthy',
    data: {
      uptime: process.uptime()
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/chat', messageRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => fail(res, 404, 'API route not found'));

app.use((err, req, res, next) => {
  const isUploadError = err.name === 'MulterError' || /upload|image/i.test(err.message || '');
  const status = err.status || err.statusCode || (isUploadError ? 400 : 500);
  const message = status >= 500 ? 'Internal Server Error' : err.message;

  if (status >= 500) {
    console.error(err);
  }

  return fail(res, status, message);
});

module.exports = app;
