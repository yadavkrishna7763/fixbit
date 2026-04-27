const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // Users can join a room based on their user ID to receive direct notifications
    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    // Join a specific request chat room
    socket.on('join_chat', (requestId) => {
      if (requestId) {
        socket.join(`chat_${requestId}`);
      }
    });

    // Leave chat room
    socket.on('leave_chat', (requestId) => {
      if (requestId) {
        socket.leave(`chat_${requestId}`);
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      // data: { requestId, userId, isTyping }
      if (data && data.requestId) {
        socket.to(`chat_${data.requestId}`).emit('user_typing', data);
      }
    });

    // Handle new message (will also be stored via REST API, but we emit it for real-time update)
    socket.on('send_message', (data) => {
      // data: { requestId, senderId, receiverId, body, senderName }
      if (data && data.requestId) {
        // Emit to the specific chat room
        io.to(`chat_${data.requestId}`).emit('new_message', data);
        
        // Also emit a notification to the receiver's global room
        if (data.receiverId) {
          io.to(`user_${data.receiverId}`).emit('new_message_notification', {
            requestId: data.requestId,
            senderName: data.senderName,
            body: data.body
          });
        }
      }
    });

    socket.on('disconnect', () => {
      // Handle disconnect if needed
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

module.exports = {
  initSocket,
  getIO
};
