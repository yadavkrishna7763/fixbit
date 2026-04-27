require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const ensureAuthSchema = require('./utils/ensureAuthSchema');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}

const PORT = process.env.PORT || 5050;

async function startServer() {
  await ensureAuthSchema();

  const server = http.createServer(app);

  // Initialize Socket.io after the database schema is ready.
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`FixBit API & Socket running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start FixBit API', error);
  process.exit(1);
});
