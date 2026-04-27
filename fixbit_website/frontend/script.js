// ==================== CONFIG ====================
const API_BASE = (() => {
  const configured = window.FIXBIT_CONFIG?.API_BASE_URL || localStorage.getItem('FIXBIT_API_BASE_URL') || '';
  if (configured) {
    const normalized = configured.replace(/\/+$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }

  const isLocal = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
  return isLocal ? 'http://localhost:5050/api' : '/api';
})();

const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');
let currentUser = null;
let socket = null;

// ==================== THEME (DARK MODE) ====================
// Theme is now automatically synced with the device's system settings in the <head> of each HTML file.

// ==================== SOCKET.IO ====================
function initSocketConnection(user) {
  if (typeof io === 'undefined') return;
  if (socket) return; // already initialized

  // Assuming SOCKET_URL is API_ORIGIN
  socket = io(API_ORIGIN, {
    withCredentials: true
  });

  socket.on('connect', () => {
    if (user && user.id) {
      socket.emit('join_user_room', user.id);
    }
  });

  socket.on('new_message_notification', (data) => {
    showToast(`New message from ${data.senderName}: ${data.body}`, 'info');
    // If we're not currently looking at the chat, we could show an unread badge
  });

  socket.on('new_request_nearby', (data) => {
    if (user && user.role === 'shop') {
      showToast(`New nearby request: ${data.brand} ${data.model}`, 'success');
      if (typeof loadNearbyRequests === 'function') loadNearbyRequests();
    }
  });

  socket.on('new_quote_received', (data) => {
    if (user && user.role === 'user') {
      showToast(`A shop has sent a quote for your request!`, 'success');
      if (typeof loadMyRequests === 'function') loadMyRequests();
    }
  });

  socket.on('notification:new', () => {
    showToast('You have a new notification', 'info');
    if (typeof refreshNotifications === 'function') {
      refreshNotifications().catch(() => { });
    }
  });

  socket.on('new_message', (data) => {
    // If we have a global chatRequestId and it matches
    if (typeof chatRequestId !== 'undefined' && Number(chatRequestId) === Number(data.request_id)) {
      const container = document.getElementById('chatMessages');
      if (container && document.getElementById('chatModal').style.display !== 'none') {
        // Append the message
        const isSent = data.sender_id === user.id;
        // Check if there's a "No messages yet" text and clear it
        if (container.innerHTML.includes('No messages yet')) container.innerHTML = '';

        container.insertAdjacentHTML('beforeend', `
          <div class="chat-bubble ${isSent ? 'sent' : 'received'}" style="animation: fadeUp 0.2s ease forwards;">${escapeHTML(data.body)}</div>
          <div style="font-size:.7rem; color:var(--slate-300); text-align:${isSent ? 'right' : 'left'}; margin-bottom:.4rem; margin-${isSent ? 'right' : 'left'}:.5rem;">${escapeHTML(data.sender_name)}</div>
        `);
        container.scrollTop = container.scrollHeight;
        if (typeof markMessagesRead === 'function') markMessagesRead(chatRequestId).catch(() => { });
      }
    }
  });

  socket.on('user_typing', (data) => {
    if (typeof chatRequestId !== 'undefined' && Number(chatRequestId) === Number(data.requestId)) {
      const typingInd = document.getElementById('typingIndicator');
      if (typingInd) {
        typingInd.style.display = data.isTyping ? 'block' : 'none';
      }
    }
  });
}

// ==================== HELPERS ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${escapeHTML(message)}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function assetUrl(path) {
  if (!path) return '';
  return String(path).startsWith('http') ? path : `${API_ORIGIN}${path.startsWith('/') ? path : `/uploads/${path}`}`;
}

function normalizeEmailInput(value) {
  const cleaned = String(value || '').trim().toLowerCase();
  return cleaned || '';
}

function normalizePhoneInput(value, countryCode = '91') {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+${countryCode}${digits}`;
  if (digits.length === countryCode.length + 10 && digits.startsWith(countryCode)) return `+${digits}`;
  return '';
}

function detectIdentifierType(value) {
  return String(value || '').includes('@') ? 'email' : 'phone';
}

async function apiRequest(endpoint, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, config);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await res.json()
      : { success: false, message: await res.text() || 'Request failed' };

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    const isNetworkError = err instanceof TypeError || /Failed to fetch|Load failed|NetworkError/i.test(String(err.message || ''));
    const normalizedMessage = isNetworkError
      ? 'Unable to reach the server right now. Please check your connection and try again.'
      : (err.message || 'Request failed');
    showToast(normalizedMessage, 'error');
    throw new Error(normalizedMessage);
  }
}

function checkAuth() {
  const token = localStorage.getItem('token');
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('user') || 'null');
  } catch (e) {
    localStorage.removeItem('user');
  }

  if (!token || !user) {
    if (!window.location.pathname.includes('login.html') &&
      !window.location.pathname.includes('register') &&
      !window.location.pathname.includes('index.html')) {
      window.location.href = 'login.html';
    }
    return null;
  }
  currentUser = user;
  initSocketConnection(user);
  return user;
}

function requireRole(role) {
  const user = checkAuth();
  if (!user) return null;
  if (user.role !== role) {
    showToast('You do not have access to this page', 'error');
    window.location.href = user.role === 'shop' ? 'shop-dashboard.html' : 'user-dashboard.html';
    return null;
  }
  return user;
}

// ==================== AUTH ====================
async function login(identifier, password) {
  const normalizedIdentifier = detectIdentifierType(identifier) === 'email'
    ? normalizeEmailInput(identifier)
    : normalizePhoneInput(identifier);
  const data = await apiRequest('/auth/login', 'POST', { identifier: normalizedIdentifier || identifier, password }, false);
  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;
    showToast('Login successful!', 'success');

    // Admin check – redirect to admin page if admin email
    const adminEmails = ['admin@fixbit.com', 'admin@gmail.com'];
    if (adminEmails.includes(String(data.user.email || '').toLowerCase())) {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = data.user.role === 'shop' ? 'shop-dashboard.html' : 'user-dashboard.html';
    }
  }
  return data;
}

async function startRegistrationOtp(registrationData) {
  const payload = {
    email: normalizeEmailInput(registrationData.email),
    phone: normalizePhoneInput(registrationData.phone),
    role: registrationData.role,
    verification_channel: registrationData.verificationChannel || 'email'
  };
  return await apiRequest('/auth/register/start', 'POST', payload, false);
}

async function completeRegistrationOtp(registrationData, verificationId, otp) {
  return await apiRequest('/auth/register/verify', 'POST', {
    ...registrationData,
    email: normalizeEmailInput(registrationData.email),
    phone: normalizePhoneInput(registrationData.phone),
    verification_id: verificationId,
    otp
  }, false);
}

async function resendRegistrationOtp(verificationId) {
  return await apiRequest('/auth/register/resend', 'POST', { verification_id: verificationId }, false);
}

async function forgotPassword(identifier, channel = '') {
  const type = detectIdentifierType(identifier);
  return await apiRequest('/auth/forgot-password', 'POST', {
    identifier: type === 'email' ? normalizeEmailInput(identifier) : normalizePhoneInput(identifier),
    channel
  }, false);
}

async function resendForgotPasswordOtp(verificationId) {
  return await apiRequest('/auth/forgot-password/resend', 'POST', { verification_id: verificationId }, false);
}

async function verifyForgotPasswordOtp(verificationId, otp) {
  return await apiRequest('/auth/forgot-password/verify', 'POST', {
    verification_id: verificationId,
    otp
  }, false);
}

async function resetPassword(resetToken, password) {
  return await apiRequest('/auth/reset-password', 'POST', { reset_token: resetToken, password }, false);
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// ==================== LOCATION ====================
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err)
    );
  });
}

// ==================== USER DASHBOARD ====================
async function submitUserRequest(formData) {
  const form = new FormData();
  for (let key in formData) {
    if (key === 'imageFile' && formData[key]) {
      form.append('image', formData[key]);
    } else if (formData[key] !== undefined) {
      form.append(key, formData[key]);
    }
  }
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    });
    const data = await res.json().catch(() => ({ success: false, message: 'Request failed' }));
    if (data.success) {
      showToast('Request submitted!', 'success');
      return true;
    }

    showToast(data.message || 'Request failed', 'error');
    return false;
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
    return false;
  }
}

async function loadUserRequests() {
  const data = await apiRequest('/requests/my');
  if (data.success) return data.requests;
  return [];
}

async function loadQuotesForRequest(requestId) {
  const data = await apiRequest(`/responses/request/${requestId}`);
  return data.success ? data.responses : [];
}

async function acceptQuote(requestId, shopId) {
  const data = await apiRequest(`/requests/${requestId}/accept`, 'PUT', { shop_id: shopId });
  if (data.success) showToast('Quote accepted!', 'success');
  return data.success;
}

// ==================== SHOP DASHBOARD ====================
async function loadNearbyRequests(lat, lng) {
  const data = await apiRequest(`/requests/nearby?lat=${lat}&lng=${lng}`);
  return data.success ? data.requests : [];
}

async function sendQuote(requestId, price, message = '') {
  const data = await apiRequest('/responses', 'POST', { request_id: requestId, price, message });
  if (data.success) showToast('Quote sent!', 'success');
  return data.success;
}

async function loadShopQuotes() {
  const data = await apiRequest('/responses/shop');
  return data.success ? data.quotes : [];
}

async function updateRequestStatus(requestId, status) {
  const data = await apiRequest(`/requests/${requestId}/status`, 'PUT', { status });
  if (data.success) showToast('Status updated', 'success');
  return data.success;
}

// ==================== SHOP SEARCH ====================
async function searchShops(query, lat, lng) {
  let url = `/shops/search?q=${encodeURIComponent(query)}`;
  if (lat && lng) url += `&lat=${lat}&lng=${lng}`;
  return await apiRequest(url);
}

// ==================== MESSAGING ====================
async function sendMessage(requestId, receiverId, body) {
  return await apiRequest('/chat', 'POST', { request_id: requestId, receiver_id: receiverId, body });
}

async function sendChatImage(requestId, receiverId, imageFile, body = '') {
  const compressedFile = await compressImageFile(imageFile, 1600, 0.72);
  const form = new FormData();
  form.append('request_id', String(requestId));
  form.append('receiver_id', String(receiverId));
  if (body) form.append('body', body);
  form.append('image', compressedFile || imageFile);

  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Upload failed' }));
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Image upload failed');
  }
  return data;
}

async function getMessages(requestId) {
  return await apiRequest(`/chat/request/${requestId}`);
}

async function markMessagesRead(requestId) {
  return await apiRequest(`/chat/read/${requestId}`, 'PUT');
}

// ==================== NOTIFICATIONS ====================
async function loadMyNotifications(limit = 40) {
  return await apiRequest(`/notifications/my?limit=${encodeURIComponent(limit)}`);
}

async function markNotificationRead(notificationId) {
  return await apiRequest(`/notifications/${notificationId}/read`, 'PUT');
}

async function markAllNotificationsRead() {
  return await apiRequest('/notifications/read-all', 'PUT');
}

function renderNotificationItems(container, notifications = []) {
  if (!container) return;
  if (!notifications.length) {
    container.innerHTML = '<div style="padding:.9rem; color:var(--slate-400); font-size:.83rem;">No notifications yet</div>';
    return;
  }

  container.innerHTML = notifications.map(item => `
    <button type="button" data-notification-id="${item.id}" class="notification-item" onclick="handleNotificationClick(${item.id}, '${item.type}', '${encodeURIComponent(JSON.stringify(item.meta || {}))}')" style="display:flex;align-items:flex-start;gap:12px;width:100%;text-align:left;padding:1rem .8rem;border-bottom:1px solid var(--border-color);background:${item.is_read ? 'transparent' : 'var(--teal-50)'};transition:background 0.2s;">
      <div style="flex-shrink:0;margin-top:6px;width:8px;height:8px;border-radius:50%;background:${item.is_read ? 'transparent' : 'var(--teal-500)'};"></div>
      <div style="flex:1;">
        <div style="font-weight:${item.is_read ? '500' : '700'};font-size:.9rem;color:${item.is_read ? 'var(--slate-600)' : 'var(--slate-800)'};">${escapeHTML(item.title || 'Update')}</div>
        <div style="font-size:.8rem;color:var(--slate-500);margin-top:.2rem;">${escapeHTML(item.body || '')}</div>
      </div>
    </button>
  `).join('');
}

window.handleNotificationClick = async (id, type, metaStr) => {
  await markNotificationRead(id);
  const panel = document.getElementById('notificationPanel');
  if (panel) panel.style.display = 'none';
  if (typeof refreshNotifications === 'function') refreshNotifications();
  
  let meta = {};
  try { meta = JSON.parse(decodeURIComponent(metaStr)); } catch (e) {}
  
  if (type === 'new_message' && meta.requestId) {
    if (typeof window.openChat === 'function') {
      const otherId = meta.senderId || meta.shopId || meta.userId;
      window.openChat(meta.requestId, otherId);
    }
  } else if (type === 'new_quote') {
    if (typeof window.showTab === 'function') {
      const tabBtn = document.querySelector('[onclick*="myRequests"]');
      if (tabBtn) {
        window.showTab('myRequests', tabBtn);
        if (typeof window.selectRequestAndViewQuotes === 'function' && meta.requestId) {
          setTimeout(() => window.selectRequestAndViewQuotes(meta.requestId), 500);
        }
      }
    }
  } else if (type === 'quote_accepted') {
    if (typeof window.showTab === 'function') {
      const tabBtn = document.querySelector('[onclick*="quotes"]');
      if (tabBtn) window.showTab('quotes', tabBtn);
    }
  } else if (type === 'new_request') {
    if (typeof window.showTab === 'function') {
      const tabBtn = document.querySelector('[onclick*="nearby"]');
      if (tabBtn) window.showTab('nearby', tabBtn);
    }
  }
};

async function compressImageFile(file, maxDimension = 1600, quality = 0.72) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

// ==================== REVIEWS ====================
async function submitReview(requestId, rating, comment) {
  return await apiRequest('/reviews', 'POST', { request_id: requestId, rating, comment });
}

async function getShopReviews(shopId) {
  return await apiRequest(`/reviews/shop/${shopId}`);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Set up logout buttons
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', logout);
  });

  // Page-specific initializations can be added here
});
