const Request = require('../models/requestModel');
const Message = require('../models/messageModel');
const { ok, fail } = require('../utils/apiResponse');
const { getIO } = require('../socket');
const { cleanString } = require('../utils/validation');

function getCounterparty(request, userId) {
  const currentUserId = Number(userId);
  const requestUserId = Number(request.user_id);
  const acceptedShopId = Number(request.accepted_shop_id);

  if (!acceptedShopId) return null;
  if (currentUserId === requestUserId) return acceptedShopId;
  if (currentUserId === acceptedShopId) return requestUserId;
  return null;
}

async function loadConversationContext(requestId, userId) {
  const request = await Request.findById(requestId);
  if (!request) {
    return { errorStatus: 404, errorMessage: 'Request not found' };
  }

  if (request.status === 'pending' || !request.accepted_shop_id) {
    return { errorStatus: 400, errorMessage: 'Chat starts after a quote is accepted' };
  }

  const receiverId = getCounterparty(request, userId);
  if (!receiverId) {
    return { errorStatus: 403, errorMessage: 'Access denied' };
  }

  return { request, receiverId };
}

async function sendMessage(req, res) {
  const requestId = Number(req.body.request_id);
  const requestedReceiverId = Number(req.body.receiver_id);
  const body = cleanString(req.body.body, 2000);

  if (!Number.isInteger(requestId) || requestId <= 0 || !body) {
    return fail(res, 400, 'Request ID and message are required');
  }

  const context = await loadConversationContext(requestId, req.user.id);
  if (context.errorStatus) {
    return fail(res, context.errorStatus, context.errorMessage);
  }

  if (Number.isInteger(requestedReceiverId) && requestedReceiverId > 0 && requestedReceiverId !== context.receiverId) {
    return fail(res, 400, 'Receiver does not match this conversation');
  }

  const duplicate = await Message.findRecentDuplicate({
    requestId,
    senderId: req.user.id,
    receiverId: context.receiverId,
    body
  });

  if (duplicate) {
    return ok(res, 'Duplicate message ignored', { messageId: duplicate.id, duplicate: true });
  }

  const messageId = await Message.createMessage({
    requestId,
    senderId: req.user.id,
    receiverId: context.receiverId,
    body
  });

  try {
    const io = getIO();
    const data = {
      id: messageId,
      request_id: requestId,
      sender_id: req.user.id,
      receiver_id: context.receiverId,
      body,
      sender_name: req.user.name,
      created_at: new Date().toISOString()
    };
    io.to(`chat_${requestId}`).emit('new_message', data);
    io.to(`user_${context.receiverId}`).emit('new_message_notification', {
      requestId,
      senderName: req.user.name,
      body
    });
  } catch (e) {
    console.error('Socket error emitting message', e);
  }

  return ok(res, 'Message sent', { messageId }, 201);
}

async function getMessages(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail(res, 400, 'Invalid request id');
  }

  const context = await loadConversationContext(requestId, req.user.id);
  if (context.errorStatus) {
    return fail(res, context.errorStatus, context.errorMessage);
  }

  const messages = await Message.listForRequest(requestId);
  return ok(res, 'Messages loaded', { messages, receiverId: context.receiverId });
}

async function markMessagesRead(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return fail(res, 400, 'Invalid request id');
  }

  const context = await loadConversationContext(requestId, req.user.id);
  if (context.errorStatus) {
    return fail(res, context.errorStatus, context.errorMessage);
  }

  await Message.markRead(requestId, req.user.id);
  return ok(res, 'Messages marked as read');
}

module.exports = {
  sendMessage,
  getMessages,
  markMessagesRead
};
