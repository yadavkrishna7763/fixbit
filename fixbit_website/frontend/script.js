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

// ==================== SOCKET.IO ====================
function initSocketConnection(user) {
  if (typeof io === 'undefined') return;
  if (socket) return; // already initialized

  // Assuming SOCKET_URL is API_ORIGIN
  socket = io(API_ORIGIN, {
    withCredentials: true
  });

  socket.on('connect', () => {
    console.log('Socket connected');
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
        if (typeof markMessagesRead === 'function') markMessagesRead(chatRequestId).catch(() => {});
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
    showToast(err.message, 'error');
    throw err;
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
async function login(email, password) {
  const data = await apiRequest('/auth/login', 'POST', { email, password }, false);
  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;
    showToast('Login successful!', 'success');
    
    // Admin check – redirect to admin page if admin email
    const adminEmails = ['admin@fixbit.com', 'admin@gmail.com'];
    if (adminEmails.includes(data.user.email)) {
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 500);
    } else {
      setTimeout(() => {
        window.location.href = data.user.role === 'shop' ? 'shop-dashboard.html' : 'user-dashboard.html';
      }, 500);
    }
  }
  return data;
}

async function register(userData) {
  const data = await apiRequest('/auth/register', 'POST', userData, false);
  if (data.success) {
    showToast('Registration successful! Please login.', 'success');
    setTimeout(() => window.location.href = 'login.html', 1000);
  }
  return data;
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

async function getMessages(requestId) {
  return await apiRequest(`/chat/request/${requestId}`);
}

async function markMessagesRead(requestId) {
  return await apiRequest(`/chat/read/${requestId}`, 'PUT');
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
