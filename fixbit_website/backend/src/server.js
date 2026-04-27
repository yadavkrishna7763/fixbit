require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}

const PORT = process.env.PORT || 5050;

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(PORT, () => {
  console.log(`FixBit API & Socket running on port ${PORT}`);
});
