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
  return await registerAccount({
    ...registrationData,
    email: normalizeEmailInput(registrationData.email),
    phone: normalizePhoneInput(registrationData.phone)
  });
}

async function registerAccount(registrationData) {
  const payload = {
    name: String(registrationData.name || '').trim(),
    email: normalizeEmailInput(registrationData.email),
    phone: normalizePhoneInput(registrationData.phone),
    role: registrationData.role,
    password: String(registrationData.password || ''),
    latitude: registrationData.latitude ?? null,
    longitude: registrationData.longitude ?? null
  };
  return await apiRequest('/auth/register', 'POST', payload, false);
}

async function completeRegistrationOtp(registrationData, verificationId, otp) {
  return await registerAccount(registrationData);
}

async function resendRegistrationOtp(verificationId) {
  throw new Error('OTP-based registration is not available on this backend');
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

// ==================== FALLBACK PAGE HELPERS ====================
function showRegOptions() {
  const modal = document.getElementById('regModal');
  if (modal) modal.style.display = 'flex';
}

function hideRegOptions() {
  const modal = document.getElementById('regModal');
  if (modal) modal.style.display = 'none';
}

function closeLandingMenu() {
  hideRegOptions();
}

function showSection(section) {
  const sectionUsers = document.getElementById('section-users');
  const sectionRequests = document.getElementById('section-requests');
  const btnUsers = document.getElementById('btnUsers');
  const btnRequests = document.getElementById('btnRequests');

  if (sectionUsers) sectionUsers.style.display = section === 'users' ? 'block' : 'none';
  if (sectionRequests) sectionRequests.style.display = section === 'requests' ? 'block' : 'none';
  if (btnUsers) {
    btnUsers.classList.toggle('btn-primary', section === 'users');
    btnUsers.classList.toggle('btn-outline', section !== 'users');
  }
  if (btnRequests) {
    btnRequests.classList.toggle('btn-primary', section === 'requests');
    btnRequests.classList.toggle('btn-outline', section !== 'requests');
  }
  if (section === 'users') loadUsers();
  if (section === 'requests') loadAllRequests();
}

async function loadUsers() {
  const container = document.getElementById('usersTable') || document.getElementById('usersListBody');
  if (!container) return;
  if (container.id === 'usersTable') {
    container.innerHTML = '<div class="p-4 text-center">Loading users...</div>';
  }

  try {
    const role = document.getElementById('userFilter')?.value;
    const url = `/admin/users${role ? '?role=' + encodeURIComponent(role) : ''}`;
    const res = await apiRequest(url);
    if (!res.success) throw new Error(res.message || 'Load failed');

    if (container.id === 'usersTable') {
      container.innerHTML = `
        <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead class="bg-slate-100 dark:bg-slate-700">
            <tr>
              <th class="p-3 text-left">ID</th>
              <th class="p-3 text-left">Name</th>
              <th class="p-3 text-left">Email</th>
              <th class="p-3 text-left">Phone</th>
              <th class="p-3 text-left">Role</th>
              <th class="p-3 text-left">Rating</th>
              <th class="p-3 text-left">Status</th>
              <th class="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${res.users.map(u => `
              <tr class="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td class="p-3">${u.id}</td>
                <td class="p-3 font-medium">${escapeHTML(u.name || '—')}</td>
                <td class="p-3 text-sm">${escapeHTML(u.email || '—')}</td>
                <td class="p-3">${escapeHTML(u.phone || '—')}</td>
                <td class="p-3"><span class="badge ${u.role === 'shop' ? 'badge-orange' : 'badge-teal'}">${escapeHTML(u.role)}</span></td>
                <td class="p-3">${u.avg_rating ? '⭐ ' + parseFloat(u.avg_rating).toFixed(1) : '—'}</td>
                <td class="p-3"><span class="${u.banned ? 'text-red-600 font-semibold' : 'text-green-600'}">${u.banned ? '🚫 Banned' : '✅ Active'}</span></td>
                <td class="p-3"><button onclick="toggleBan(${u.id}, ${u.banned})" class="btn btn-sm ${u.banned ? 'btn-primary' : 'btn-outline'}">${u.banned ? 'Unban' : 'Ban'}</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } else {
      document.getElementById('usersListBody').innerHTML = res.users.map(u => `
        <tr style="border-bottom:1px solid var(--border-color);">
          <td style="padding:1rem;">#${u.id}</td>
          <td style="padding:1rem; font-weight:600;">${escapeHTML(u.name || '')} ${u.is_verified ? '✅' : ''}</td>
          <td style="padding:1rem;"><span class="badge ${u.role === 'shop' ? 'badge-orange' : 'badge-teal'}">${escapeHTML(u.role)}</span></td>
          <td style="padding:1rem;">${escapeHTML(u.phone || '')}</td>
          <td style="padding:1rem;">${u.banned ? '<span class="badge badge-red">BANNED</span>' : '<span class="badge badge-green">ACTIVE</span>'}</td>
          <td style="padding:1rem; text-align:right;"><button class="btn btn-sm btn-outline" onclick="openUserModal(${u.id})">Details</button></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    if (container.id === 'usersTable') {
      container.innerHTML = `<div class="p-4 text-red-600">Error: ${escapeHTML(err.message)}</div>`;
    }
    showToast('Failed to load users', 'error');
  }
}

async function loadAllRequests() {
  const container = document.getElementById('requestsTable');
  if (!container) return;
  container.innerHTML = '<div class="p-4 text-center">Loading requests...</div>';
  try {
    const res = await apiRequest('/admin/requests');
    if (!res.success) throw new Error(res.message || 'Load failed');

    container.innerHTML = `
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead class="bg-slate-100 dark:bg-slate-700">
          <tr>
            <th class="p-3 text-left">ID</th>
            <th class="p-3 text-left">User</th>
            <th class="p-3 text-left">Device</th>
            <th class="p-3 text-left">Issue</th>
            <th class="p-3 text-left">Status</th>
            <th class="p-3 text-left">Shop</th>
            <th class="p-3 text-left">Created</th>
            <th class="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          ${res.requests.map(r => `
            <tr class="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td class="p-3">${r.id}</td>
              <td class="p-3">${escapeHTML(r.user_name || '—')}</td>
              <td class="p-3">${escapeHTML(r.device_type || 'Phone')} ${escapeHTML(r.brand || '')} ${escapeHTML(r.model || '')}</td>
              <td class="p-3">${escapeHTML(r.issue_type || '')}</td>
              <td class="p-3"><span class="badge badge-teal">${escapeHTML(r.status || '')}</span></td>
              <td class="p-3">${escapeHTML(r.shop_name || '—')}</td>
              <td class="p-3">${new Date(r.created_at).toLocaleDateString()}</td>
              <td class="p-3"><button onclick="deleteRequest(${r.id})" class="btn btn-sm btn-outline text-red-600">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    container.innerHTML = `<div class="p-4 text-red-600">Error: ${escapeHTML(err.message)}</div>`;
    showToast('Failed to load requests', 'error');
  }
}

async function toggleBan(userId, currentlyBanned) {
  const action = currentlyBanned ? 'unban' : 'ban';
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;
  try {
    const res = await apiRequest(`/admin/users/${userId}/ban`, 'PUT', { banned: !currentlyBanned });
    if (res.success) {
      showToast(`User ${action}ned`, 'success');
      loadUsers();
    } else {
      showToast(res.message || 'Action failed', 'error');
    }
  } catch (err) {
    showToast('Failed to update user', 'error');
  }
}

async function deleteRequest(id) {
  if (!confirm('Permanently delete this request?')) return;
  try {
    await apiRequest(`/admin/requests/${id}`, 'DELETE');
    showToast('Request deleted', 'success');
    loadAllRequests();
  } catch (err) {
    showToast('Delete failed', 'error');
  }
}

async function loadAnalytics() {
  try {
    const res = await apiRequest('/admin/analytics');
    if (res.success) {
      const statUsers = document.getElementById('statUsers');
      const statShops = document.getElementById('statShops');
      const statRequests = document.getElementById('statRequests');
      if (statUsers) statUsers.innerText = res.totalUsers ?? 0;
      if (statShops) statShops.innerText = res.totalShops ?? 0;
      if (statRequests) statRequests.innerText = res.activeRequests ?? 0;
    }
  } catch (e) {
    showToast('Error loading analytics', 'error');
  }
}

let currentUsers = [];
window.openUserModal = (id) => {
  const u = currentUsers.find(x => x.id === id);
  if (!u) return;
  const udName = document.getElementById('udName');
  const udContent = document.getElementById('udContent');
  const udActions = document.getElementById('udActions');
  if (udName) udName.innerText = `${u.name} (ID: ${u.id})`;
  if (udContent) udContent.innerHTML = `
    <p><strong>Email:</strong> ${escapeHTML(u.email || 'N/A')}</p>
    <p><strong>Phone:</strong> ${escapeHTML(u.phone || 'N/A')}</p>
    <p><strong>Role:</strong> ${escapeHTML(u.role || 'N/A')}</p>
    <p><strong>Status:</strong> ${u.banned ? 'Banned' : 'Active'}</p>
    ${u.role === 'shop' ? `
      <hr style="margin:1rem 0; border:none; border-top:1px solid var(--slate-200);">
      <p><strong>Verified Shop:</strong> ${u.is_verified ? 'Yes ✅' : 'No ❌'}</p>
      <p><strong>Address:</strong> ${escapeHTML(u.address || 'N/A')}</p>
      <p><strong>Completed Jobs:</strong> ${u.completed_jobs ?? 0}</p>
      <p><strong>Rating:</strong> ${u.avg_rating ?? 'N/A'}</p>
    ` : ''}
  `;
  const actions = [];
  actions.push(`<button class="btn btn-sm ${u.banned ? 'btn-green' : 'btn-outline'}" onclick="toggleBan(${u.id}, ${u.banned})">${u.banned ? 'Unban Account' : 'Ban Account'}</button>`);
  if (u.role === 'shop') {
    actions.push(`<button class="btn btn-sm ${u.is_verified ? 'btn-outline' : 'btn-primary'}" onclick="toggleVerify(${u.id}, ${u.is_verified ? 'false' : 'true'})">${u.is_verified ? 'Revoke Verification' : 'Approve (Verify) Shop'}</button>`);
  }
  if (udActions) udActions.innerHTML = actions.join(' ');
  const userDetailModal = document.getElementById('userDetailModal');
  if (userDetailModal) userDetailModal.style.display = 'flex';
};

window.closeUserModal = () => {
  const modal = document.getElementById('userDetailModal');
  if (modal) modal.style.display = 'none';
};

window.toggleVerify = async (id, is_verified) => {
  try {
    const res = await apiRequest(`/admin/users/${id}/verify`, 'PUT', { is_verified });
    if (res.success) {
      showToast(res.message, 'success');
      closeUserModal();
      loadUsers();
    }
  } catch (e) {
    showToast('Action failed', 'error');
  }
};

async function loadComplaints() {
  const container = document.getElementById('complaintsList');
  if (!container) return;
  container.innerHTML = 'Loading...';
  try {
    const res = await apiRequest('/admin/complaints');
    if (!res.success) throw new Error(res.message || 'Load failed');
    if (!res.complaints.length) {
      container.innerHTML = '<div class="empty-state">No support tickets</div>';
      return;
    }
    container.innerHTML = res.complaints.map(c => `
      <div class="card mb-3" style="border-left: 4px solid ${c.status === 'open' ? 'var(--orange-500)' : 'var(--green-500)'}">
        <div style="display:flex; justify-content:space-between;">
          <h4 style="font-weight:700;">${escapeHTML(c.subject)}</h4>
          <span class="badge ${c.status === 'open' ? 'badge-orange' : 'badge-green'}">${escapeHTML(c.status.toUpperCase())}</span>
        </div>
        <p style="font-size:0.85rem; color:var(--slate-500); margin:0.5rem 0;">From: ${escapeHTML(c.user_name)} (${escapeHTML(c.user_role)}) - ${escapeHTML(c.user_phone)}</p>
        <div style="background:var(--slate-50); padding:0.8rem; border-radius:8px; margin-bottom:1rem; font-size:0.9rem;">${escapeHTML(c.description)}</div>
        ${c.status === 'resolved' ? `<div style="background:#f0fdfa; border:1px solid #ccfbf1; padding:0.8rem; border-radius:8px; font-size:0.9rem; color:var(--teal-800);"><strong>Admin Response:</strong> ${escapeHTML(c.admin_response)}</div>` : `<button class="btn btn-sm btn-primary" onclick="openResolveModal(${c.id})">Respond & Resolve</button>`}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = 'Error loading complaints';
  }
}

window.openResolveModal = (id) => {
  const rcId = document.getElementById('rcId');
  const rcResponse = document.getElementById('rcResponse');
  const modal = document.getElementById('resolveComplaintModal');
  if (rcId) rcId.value = id;
  if (rcResponse) rcResponse.value = '';
  if (modal) modal.style.display = 'flex';
};

window.closeResolveModal = () => {
  const modal = document.getElementById('resolveComplaintModal');
  if (modal) modal.style.display = 'none';
};

window.submitResolution = async () => {
  const idValue = document.getElementById('rcId');
  const responseElem = document.getElementById('rcResponse');
  const id = idValue?.value;
  const response = responseElem?.value;
  if (!response?.trim()) {
    showToast('Response is required', 'error');
    return;
  }
  try {
    const res = await apiRequest(`/admin/complaints/${id}/resolve`, 'PUT', { admin_response: response });
    if (res.success) {
      showToast('Ticket resolved', 'success');
      closeResolveModal();
      loadComplaints();
    }
  } catch (e) {
    showToast('Action failed', 'error');
  }
};

// User dashboard helpers
window.previewImage = (input) => {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImg = document.getElementById('previewImg');
    if (previewImg) {
      previewImg.src = e.target.result;
      document.getElementById('imagePreview').style.display = 'inline-block';
    }
  };
  reader.readAsDataURL(file);
};

window.clearImage = () => {
  const input = document.getElementById('image');
  if (input) input.value = '';
  const preview = document.getElementById('imagePreview');
  if (preview) preview.style.display = 'none';
};

function onDeviceTypeChange() {
  const deviceType = document.getElementById('deviceType')?.value;
  document.getElementById('device_type_hidden').value = deviceType || '';
  const brandSelect = document.getElementById('brand');
  const modelSelect = document.getElementById('modelSelect');
  const customInput = document.getElementById('modelCustom');
  if (!brandSelect || !modelSelect || !customInput) return;
  brandSelect.innerHTML = '<option value="">Select Brand</option>';
  if (deviceType && window.deviceCatalog?.[deviceType]) {
    Object.keys(window.deviceCatalog[deviceType].brands).forEach(brand => {
      const o = document.createElement('option');
      o.value = brand; o.textContent = brand;
      brandSelect.appendChild(o);
    });
  }
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  modelSelect.style.display = 'block';
  customInput.style.display = 'none';
  document.getElementById('model').value = '';
  populateIssueTypes(deviceType);
}

function populateModels() {
  const deviceType = document.getElementById('deviceType')?.value;
  const brand = document.getElementById('brand')?.value;
  const modelSelect = document.getElementById('modelSelect');
  const customInput = document.getElementById('modelCustom');
  if (!modelSelect || !customInput) return;
  modelSelect.innerHTML = '<option value="">Select Model</option>';
  if (deviceType && brand && window.deviceCatalog?.[deviceType]?.brands?.[brand]) {
    const models = window.deviceCatalog[deviceType].brands[brand];
    if (models.length) {
      models.forEach(model => {
        const o = document.createElement('option');
        o.value = model; o.textContent = model;
        modelSelect.appendChild(o);
      });
      modelSelect.style.display = 'block';
      customInput.style.display = 'none';
    } else {
      modelSelect.style.display = 'none';
      customInput.style.display = 'block';
    }
  }
  updateHiddenModel();
}

function handleModelSelect() {
  const brand = document.getElementById('brand')?.value;
  const modelSelect = document.getElementById('modelSelect');
  const customInput = document.getElementById('modelCustom');
  if (brand === 'Other') {
    customInput.style.display = 'block';
    modelSelect.style.display = 'none';
  } else {
    customInput.style.display = 'none';
    modelSelect.style.display = 'block';
  }
  updateHiddenModel();
}

function updateHiddenModel() {
  const brand = document.getElementById('brand')?.value;
  const modelSelect = document.getElementById('modelSelect');
  const customInput = document.getElementById('modelCustom');
  const hidden = document.getElementById('model');
  if (!hidden) return;
  hidden.value = brand === 'Other' ? customInput?.value || '' : modelSelect?.value || '';
}

function populateIssueTypes(deviceType) {
  const issueSelect = document.getElementById('issue_type');
  if (!issueSelect) return;
  issueSelect.innerHTML = '<option value="">— Select an issue —</option>';
  if (!deviceType || !window.deviceCatalog?.[deviceType]) return;
  window.deviceCatalog[deviceType].issues.forEach(group => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = group.group;
    group.options.forEach(issue => {
      const o = document.createElement('option');
      o.value = issue; o.textContent = issue;
      optgroup.appendChild(o);
    });
    issueSelect.appendChild(optgroup);
  });
}

window.openReviewModal = (requestId) => {
  const modal = document.getElementById('reviewModal');
  if (!modal) return;
  document.getElementById('reviewRequestId').value = requestId;
  document.getElementById('reviewModal').style.display = 'flex';
};

window.closeReviewModal = () => {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.style.display = 'none';
};

window.acceptQuoteAndRefresh = async (requestId, shopId) => {
  if (await acceptQuote(requestId, shopId)) loadQuotesForCurrentRequest();
};

window.renderQuotesList = () => {
  const container = document.getElementById('quotesList');
  if (!container) return;
  const sortType = document.getElementById('quotesSortSelect')?.value || 'price';
  const quotes = window.currentLoadedQuotes || [];
  const requestId = window.currentRequestId;

  if (!requestId || !quotes.length) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">No quotes available.</div>';
    return;
  }

  let requestStatus = 'pending';
  let acceptedShopId = null;
  let requestLat = window.globalRequestLat;
  let requestLng = window.globalRequestLng;

  Promise.resolve(apiRequest(`/requests/${requestId}`)).then(reqData => {
    if (reqData.success) {
      requestStatus = reqData.request.status;
      acceptedShopId = reqData.request.accepted_shop_id;
      requestLat = reqData.request.latitude;
      requestLng = reqData.request.longitude;
      quotes.forEach(q => {
        if (requestLat && requestLng && q.shop_latitude && q.shop_longitude) {
          q.distance = getDistanceFromLatLonInKm(requestLat, requestLng, q.shop_latitude, q.shop_longitude);
        }
      });
      renderQuotesList();
    }
  }).catch(() => {});

  let sortedQuotes = [...quotes];
  if (sortType === 'price') {
    sortedQuotes.sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortType === 'rating') {
    sortedQuotes.sort((a, b) => Number(b.shop_avg_rating || 0) - Number(a.shop_avg_rating || 0));
  } else if (sortType === 'distance') {
    sortedQuotes.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
  }

  container.innerHTML = sortedQuotes.map(q => {
    const isAccepted = requestStatus !== 'pending' && requestStatus !== 'cancelled' && Number(acceptedShopId) === Number(q.shop_id);
    const distanceText = q.distance !== undefined ? `<span style="font-size:.78rem; color:var(--slate-400);"> • 📍 ${q.distance.toFixed(1)} km away</span>` : '';
    return `
      <div class="request-card mb-3" style="${isAccepted ? 'border-color:var(--teal-200); background:linear-gradient(135deg,var(--teal-50),white);' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.6rem;">
          <div>
            <h4 style="font-weight:700; display:flex; align-items:center; gap:.25rem;">${escapeHTML(q.shop_name)} ${q.shop_is_verified ? '<span style="color:#14b8a6; font-size:.85rem;" title="Verified Shop">✅</span>' : ''}</h4>
            <div style="font-size:.78rem; color:var(--slate-400);">${q.shop_avg_rating ? '⭐ ' + parseFloat(q.shop_avg_rating).toFixed(1) : 'No ratings yet'} • ${q.shop_completed_jobs || 0} jobs done ${distanceText}</div>
          </div>
          <div class="price-tag">₹${q.price}</div>
        </div>
        <p style="font-size:.85rem; color:var(--slate-500); margin-bottom:.8rem;">${escapeHTML(q.message || 'No additional message')}</p>
        ${!isAccepted && requestStatus === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="acceptQuoteAndRefresh(${requestId}, ${q.shop_id})">✓ Accept This Quote</button>` : ''}
        ${isAccepted ? `<div style="display:flex; align-items:center; gap:.6rem; flex-wrap:wrap;"><span class="badge badge-teal">✅ Accepted</span>${q.shop_phone ? `<span style="font-size:.82rem; background:var(--teal-50); border:1px solid var(--teal-200); color:var(--teal-700); padding:.3rem .8rem; border-radius:8px;">📞 ${escapeHTML(q.shop_phone)}</span>` : ''}${q.shop_phone ? `<a href="https://wa.me/${String(q.shop_phone).replace(/\D/g, '')}" target="_blank" style="font-size:.82rem; background:var(--green-50); border:1px solid var(--green-200); color:var(--green-700); padding:.3rem .8rem; border-radius:8px; text-decoration:none;">📱 WhatsApp</a>` : ''}</div>` : ''}
      </div>`;
  }).join('');
};

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

window.focusShopOnMap = (shopId, lat, lng) => {
  if (!window.shopsMap) return;
  window.shopsMap.setView([lat, lng], 15);
  window.shopsMarkers?.forEach(marker => {
    if (marker.getLatLng && marker.getLatLng().lat === lat && marker.getLatLng().lng === lng) {
      marker.openPopup();
    }
  });
};

window.viewShopDetails = (shopId) => {
  showToast('Select a request first or create a new one to get quotes from this shop.', 'info');
};

window.openQuoteModal = (requestId) => {
  const modalRequestId = document.getElementById('modalRequestId');
  const modal = document.getElementById('quoteModal');
  if (modalRequestId) modalRequestId.value = requestId;
  if (!modal) return;
  modal.style.display = 'flex';
  setTimeout(() => {
    const priceInput = document.getElementById('modalPrice');
    if (priceInput) priceInput.focus();
  }, 100);
};

window.closeModal = () => {
  const modal = document.getElementById('quoteModal');
  if (!modal) return;
  modal.style.display = 'none';
  const price = document.getElementById('modalPrice');
  const message = document.getElementById('modalMessage');
  if (price) price.value = '';
  if (message) message.value = '';
};

window.submitQuote = async () => {
  const requestId = document.getElementById('modalRequestId')?.value;
  const price = Number(document.getElementById('modalPrice')?.value);
  const message = document.getElementById('modalMessage')?.value || '';
  if (!requestId || !price || price <= 0) { showToast('Enter a valid price', 'error'); return; }
  if (await sendQuote(requestId, price, message)) {
    closeModal();
    loadNearby();
  }
};

window.updateStatus = async (requestId, status) => {
  if (await updateRequestStatus(requestId, status)) loadMyQuotes();
};

window.openChat = async (requestId, receiverId) => {
  window.chatRequestId = requestId;
  window.chatReceiverId = receiverId;
  const modal = document.getElementById('chatModal');
  if (!modal) return;
  modal.style.display = 'flex';
  if (socket) socket.emit('join_chat', chatRequestId);
  await loadChatMessages();
  clearInterval(window.chatPollTimer);
  window.chatPollTimer = setInterval(() => loadChatMessages(true), 5000);
};

window.closeChat = () => {
  const modal = document.getElementById('chatModal');
  if (modal) modal.style.display = 'none';
  if (socket) socket.emit('leave_chat', window.chatRequestId);
  clearInterval(window.chatPollTimer);
};

window.handleTyping = () => {
  if (!socket) return;
  socket.emit('typing', { requestId: window.chatRequestId, userId: currentUser?.id, isTyping: true });
  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    socket.emit('typing', { requestId: window.chatRequestId, userId: currentUser?.id, isTyping: false });
  }, 1500);
};

async function loadChatMessages(silent = false) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  if (!silent) container.innerHTML = '<div style="text-align:center;color:var(--slate-400);font-size:.83rem;padding:2rem;">Loading messages...</div>';
  try {
    const data = await apiRequest(`/chat/request/${window.chatRequestId}`);
    if (!data.success) return;
    if (data.receiverId) window.chatReceiverId = data.receiverId;
    if (!data.messages.length) {
      container.innerHTML = '<div style="text-align:center;color:var(--slate-400);font-size:.83rem;padding:2rem;">No messages yet. Say hello! 👋</div>';
      return;
    }
    container.innerHTML = data.messages.map(m => `
      <div class="chat-bubble ${m.sender_id === currentUser?.id ? 'sent' : 'received'}">${escapeHTML(m.body)}</div>
      <div style="font-size:.7rem; color:var(--slate-300); text-align:${m.sender_id === currentUser?.id ? 'right' : 'left'}; margin-bottom:.4rem; margin-${m.sender_id === currentUser?.id ? 'right' : 'left'}:.5rem;">${escapeHTML(m.sender_name)}</div>`).join('');
    container.scrollTop = container.scrollHeight;
    markMessagesRead(window.chatRequestId).catch(() => {});
  } catch (e) {
    if (!silent) container.innerHTML = '<div style="text-align:center;color:var(--slate-400);font-size:.83rem;padding:2rem;">Could not load messages.</div>';
  }
}

window.sendChatMessage = async () => {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const body = input.value.trim();
  if (!body || window.chatSending) return;
  window.chatSending = true;
  input.disabled = true;
  try {
    await sendMessage(window.chatRequestId, window.chatReceiverId, body);
    input.value = '';
    await loadChatMessages(true);
  } finally {
    window.chatSending = false;
    input.disabled = false;
    input.focus();
  }
};

async function loadNearbyShopsOnMap() {
  if (!window.initShopsMap) return;
  if (typeof window.initShopsMap === 'function') window.initShopsMap();
  let userLat, userLng;
  try {
    const pos = await getCurrentPosition();
    userLat = pos.lat; userLng = pos.lng;
    window.shopsUserLocation = { lat: userLat, lng: userLng };
    window.shopsMap?.setView([userLat, userLng], 13);
    if (window.shopsUserMarker) {
      window.shopsMap.removeLayer(window.shopsUserMarker);
    }
    if (window.L) {
      window.shopsUserMarker = L.marker([userLat, userLng], {
        icon: L.divIcon({ className: 'user-location-marker', html: '<div style="background: #14b8a6; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #14b8a6;"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
      }).addTo(window.shopsMap).bindPopup('<b>Your Location</b>').openPopup();
    }
  } catch (e) {
    showToast('Could not get your location. Showing all shops.', 'info');
  }
  if (typeof window.fetchShopsForView === 'function') {
    const shops = await window.fetchShopsForView();
    if (!shops) return;
    window.shopsMarkers?.forEach(m => window.shopsMap?.removeLayer(m));
    window.shopsMarkers = [];
    shops.forEach(shop => {
      if (!shop.latitude || !shop.longitude) return;
      const marker = L.marker([shop.latitude, shop.longitude], {
        icon: L.divIcon({ className: 'shop-marker', html: '<div style="background: #f97316; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(249,115,22,0.4); font-size: 16px;">🏪</div>', iconSize: [38, 38], iconAnchor: [19, 19] })
      }).addTo(window.shopsMap);
      const popupContent = `
        <div style="min-width: 200px;">
          <h4 style="font-weight: 700; margin-bottom: 4px;">${escapeHTML(shop.name)}</h4>
          <div style="font-size: 13px; color: #64748b;">${shop.avg_rating ? '⭐ ' + parseFloat(shop.avg_rating).toFixed(1) : 'No ratings yet'}</div>
          <p style="margin: 8px 0; font-size: 14px;">📞 ${escapeHTML(shop.phone)}</p>
          <button onclick="viewShopDetails(${shop.id})" style="background: #14b8a6; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; width: 100%;">View Details & Request Quote</button>
        </div>`;
      marker.bindPopup(popupContent);
      window.shopsMarkers.push(marker);
    });
    if (shops.length && shops[0].latitude) {
      window.shopsMap.setView([shops[0].latitude, shops[0].longitude], 13);
    }
  }
}

async function loadProfile() {
  try {
    const data = await apiRequest('/users/profile');
    if (!data.success) return;
    const p = data.profile;
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const profileNameInput = document.getElementById('profileNameInput');
    const profilePhoneInput = document.getElementById('profilePhoneInput');
    const profileEmailInput = document.getElementById('profileEmailInput');
    if (profileName) profileName.innerText = p.name || 'User';
    if (profileRole) profileRole.innerText = p.role === 'shop' ? 'Shop Owner' : 'Customer';
    if (profileNameInput) profileNameInput.value = p.name || '';
    if (profilePhoneInput) profilePhoneInput.value = p.phone || '';
    if (profileEmailInput) profileEmailInput.value = p.email || '';
    const img = document.getElementById('profileImagePreview');
    if (img) img.src = p.profile_image ? assetUrl(p.profile_image) : `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'User')}&background=14b8a6&color=fff`;
  } catch (e) {
    showToast('Failed to load profile', 'error');
  }
}

async function uploadProfileImage() {
  const file = document.getElementById('profileImageInput')?.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/users/profile/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const img = document.getElementById('profileImagePreview');
      if (img) img.src = assetUrl(data.imageUrl) + '?t=' + Date.now();
      showToast('Profile picture updated', 'success');
    }
  } catch (e) {
    showToast('Upload failed', 'error');
  }
}

window.openReviewModal = (requestId) => {
  document.getElementById('reviewRequestId')?.setAttribute('value', requestId);
  document.getElementById('reviewModal')?.style.setProperty('display', 'flex');
};

window.closeReviewModal = () => {
  const modal = document.getElementById('reviewModal');
  if (modal) modal.style.display = 'none';
};

window.acceptQuoteAndRefresh = async (requestId, shopId) => {
  if (await acceptQuote(requestId, shopId)) loadQuotesForCurrentRequest();
};

window.focusShopOnMap = (shopId, lat, lng) => {
  const map = window.shopsMap;
  if (!map) return;
  map.setView([lat, lng], 15);
  window.shopsMarkers?.forEach(marker => {
    if (marker.getLatLng && marker.getLatLng().lat === lat && marker.getLatLng().lng === lng) {
      marker.openPopup();
    }
  });
};

window.viewShopDetails = (shopId) => {
  showToast('Select a request first or create a new one to get quotes from this shop.', 'info');
};

window.uploadShopImages = async () => {
  const files = document.getElementById('shopImagesInput')?.files;
  if (!files || !files.length) return;
  const formData = new FormData();
  for (const file of files) formData.append('images', file);
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/users/shop/images`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showToast('Images uploaded', 'success');
      if (typeof loadShopGallery === 'function') loadShopGallery();
    }
  } catch (e) {
    showToast('Upload failed', 'error');
  }
};

window.uploadShopProfileImage = async () => {
  const file = document.getElementById('shopProfileImageInput')?.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_BASE}/users/profile/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const img = document.getElementById('shopProfileImagePreview');
      if (img) img.src = assetUrl(data.imageUrl) + '?t=' + Date.now();
      showToast('Upload successful', 'success');
    }
  } catch (e) {
    showToast('Upload failed', 'error');
  }
};

window.closeSidebar = () => {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
};

window.toggleSidebar = () => {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('show');
};

window.selectRequestAndViewQuotes = (requestId) => {
  window.currentRequestId = requestId;
  if (typeof showTab === 'function') {
    const tab = document.querySelector('[onclick*=quotes]');
    showTab('quotes', tab);
  }
  if (typeof loadQuotesForCurrentRequest === 'function') {
    loadQuotesForCurrentRequest();
  }
};

window.setRating = (val) => {
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === Number(val));
  });
  const ratingInput = document.getElementById('rating');
  if (ratingInput) ratingInput.value = val;
};

window.openLightbox = (imageUrl) => {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  const img = lb.querySelector('img') || lb.querySelector('.lightbox-image');
  if (img) img.src = imageUrl;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => lb.classList.add('lb-open'), 100);
};

window.closeLightbox = () => {
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  lb.classList.remove('lb-open');
  setTimeout(() => { lb.style.display = 'none'; document.body.style.overflow = 'auto'; }, 300);
};

window.loadMyRequests = async () => {
  const container = document.getElementById('requestsList');
  if (!container) return;
  container.innerHTML = '<div class="empty-state" style="padding:2rem;">Loading your requests...</div>';
  try {
    const requests = await loadUserRequests();
    if (!requests.length) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;">No requests yet. Submit your first repair issue to get quotes from shops nearby.</div>';
      return;
    }
    container.innerHTML = requests.map(r => {
      const imageUrl = r.image ? assetUrl(r.image) : null;
      const deviceIcon = r.device_type === 'Laptop' ? '💻' : (r.device_type === 'Tablet' ? '📟' : '📱');
      const statusColor = { pending: 'badge-slate', accepted: 'badge-teal', in_progress: 'badge-orange', completed: 'badge-green', cancelled: 'badge-red' }[r.status] || 'badge-slate';
      return `
        <div class="request-card mb-3">
          <div style="display:flex; gap:1rem; align-items:flex-start;">
            ${imageUrl ? `<div style="cursor:pointer;flex-shrink:0;" onclick="openLightbox('${imageUrl}')">
              <img src="${imageUrl}" style="width:76px;height:76px;object-fit:cover;border-radius:12px;border:2px solid var(--slate-100);transition:transform .2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'>
            </div>` : ''}
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:.5rem; margin-bottom:.35rem;">
                <h4 style="font-weight:700; font-size:.95rem;">${deviceIcon} ${escapeHTML(r.brand)} ${escapeHTML(r.model)}</h4>
                <span class="badge ${statusColor}">${escapeHTML(String(r.status || 'pending').replace('_', ' '))}</span>
              </div>
              <p style="font-size:.8rem; color:var(--slate-400); margin-bottom:.4rem;">${escapeHTML(r.device_type || 'Phone')} · ${escapeHTML(r.issue_type || '')}</p>
              <p style="font-size:.85rem; color:var(--slate-600); margin-bottom:.75rem; line-height:1.5;">${escapeHTML(r.description || '')}</p>
              <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
                <button class="btn btn-sm btn-secondary" onclick="selectRequestAndViewQuotes(${r.id})">💬 Quotes <span style="background:var(--teal-500);color:white;border-radius:99px;padding:0 .45rem;font-size:.7rem;margin-left:.2rem;">${r.response_count || 0}</span></button>
                ${(r.status === 'accepted' || r.status === 'in_progress') ? `<button class="btn btn-sm btn-outline" onclick="openChat(${r.id}, ${r.accepted_shop_id})">💬 Chat</button>` : ''}
                ${(r.status === 'completed' && !r.reviewed) ? `<button class="btn btn-sm btn-primary" onclick="openReviewModal(${r.id})">⭐ Leave Review</button>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">Could not load requests. Please try again.</div>';
  }
};

window.loadQuotesForCurrentRequest = async () => {
  const container = document.getElementById('quotesList');
  if (!container) return;
  if (!window.currentRequestId) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">Select a request first to view quotes.</div>';
    return;
  }
  container.innerHTML = '<div class="empty-state" style="padding:2rem;">Loading quotes...</div>';
  try {
    const quotes = await loadQuotesForRequest(window.currentRequestId);
    window.currentLoadedQuotes = quotes || [];
    if (!window.currentLoadedQuotes.length) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;">No quotes yet. Shops will respond here once they see your request.</div>';
      return;
    }
    if (typeof window.renderQuotesList === 'function') {
      window.renderQuotesList();
    } else {
      container.innerHTML = window.currentLoadedQuotes.map(q => `
        <div class="request-card mb-3">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.6rem;">
            <div><strong>${escapeHTML(q.shop_name)}</strong><div style="font-size:.78rem; color:var(--slate-400);">${q.shop_avg_rating ? '⭐ ' + parseFloat(q.shop_avg_rating).toFixed(1) : 'No ratings yet'}</div></div>
            <div class="price-tag">₹${q.price}</div>
          </div>
          <p style="font-size:.85rem; color:var(--slate-500); margin-bottom:.8rem;">${escapeHTML(q.message || 'No additional message')}</p>
          <button class="btn btn-primary btn-sm" onclick="acceptQuoteAndRefresh(${window.currentRequestId}, ${q.shop_id})">✓ Accept This Quote</button>
        </div>`).join('');
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">Could not load quotes. Please try again.</div>';
  }
};

window.loadNearby = async () => {
  const container = document.getElementById('nearbyList');
  if (!container) return;
  container.innerHTML = '<div class="empty-state" style="padding:2rem;">Loading nearby requests...</div>';
  if (!window.shopLat || !window.shopLng) {
    try {
      const pos = await getCurrentPosition();
      window.shopLat = pos.lat; window.shopLng = pos.lng;
    } catch (e) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;">Enable location services to load nearby requests.</div>';
      return;
    }
  }
  try {
    const requests = await loadNearbyRequests(window.shopLat, window.shopLng);
    if (!requests.length) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;">No nearby requests right now. Check again later.</div>';
      return;
    }
    container.innerHTML = requests.map(r => {
      const imageUrl = r.image ? assetUrl(r.image) : null;
      const deviceIcon = r.device_type === 'Laptop' ? '💻' : r.device_type === 'Tablet' ? '⬛' : '📱';
      return `
        <div class="request-card mb-3">
          <div style="display:flex; gap:1rem; align-items:flex-start;">
            ${imageUrl ? `<div style="cursor:pointer;flex-shrink:0;" onclick="openLightbox('${imageUrl}')"><img src="${imageUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:12px;border:2px solid var(--slate-100);transition:transform .2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'}"></div>` : `<div style="width:80px;height:80px;border-radius:12px;background:var(--slate-100);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0;">${deviceIcon}</div>`}
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:.5rem; margin-bottom:.35rem;">
                <h4 style="font-weight:700; font-size:.95rem;">${deviceIcon} ${escapeHTML(r.brand)} ${escapeHTML(r.model)}</h4>
                <button class="btn btn-orange btn-sm" onclick="openQuoteModal(${r.id})">Send Quote</button>
              </div>
              <p style="font-size:.8rem; color:var(--slate-400); margin-bottom:.35rem;">${escapeHTML(r.device_type || 'Phone')} · ${escapeHTML(r.issue_type)}</p>
              <p style="font-size:.85rem; color:var(--slate-600); margin-bottom:.75rem; line-height:1.5;">${escapeHTML(r.description || '')}</p>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">Could not load nearby requests. Please try again.</div>';
  }
};

window.updateShopLocation = async () => {
  try {
    const pos = await getCurrentPosition();
    window.shopLat = pos.lat; window.shopLng = pos.lng;
    await apiRequest('/shops/location', 'PUT', { latitude: window.shopLat, longitude: window.shopLng });
    showToast('Location updated! 📍', 'success');
    if (document.getElementById('locationWarning')) document.getElementById('locationWarning').style.display = 'none';
    loadNearby();
  } catch (e) {
    showToast('Could not get location. Please enable GPS.', 'error');
  }
};

window.loadMyQuotes = async () => {
  const container = document.getElementById('quotesList');
  if (!container) return;
  container.innerHTML = '<div class="empty-state" style="padding:2rem;">Loading quotes...</div>';
  try {
    const quotes = await loadShopQuotes();
    if (!quotes.length) {
      container.innerHTML = '<div class="empty-state" style="padding:2rem;">No quotes yet. Browse nearby requests to send your first quote.</div>';
      return;
    }
    container.innerHTML = quotes.map(q => {
      const isAccepted = Number(q.accepted_shop_id) === Number(window.user?.id) && ['accepted', 'in_progress', 'completed'].includes(q.request_status);
      const deviceIcon = q.device_type === 'Laptop' ? '💻' : q.device_type === 'Tablet' ? '⬛' : '📱';
      return `
        <div class="request-card mb-3">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.6rem;">
            <div>
              <h4 style="font-weight:700; font-size:.95rem;">${deviceIcon} ${escapeHTML(q.brand)} ${escapeHTML(q.model)}</h4>
              <p style="font-size:.8rem; color:var(--slate-400); margin-top:.15rem;">Customer: ${escapeHTML(q.user_name)}</p>
            </div>
            <div class="price-tag">₹${q.price}</div>
          </div>
          <div style="display:flex; align-items:center; gap:.5rem; margin-bottom:.7rem;">
            <span class="badge badge-slate">${escapeHTML(String(q.request_status).replace('_', ' '))}</span>
            ${isAccepted ? `<button class="btn btn-sm btn-outline" onclick="openChat(${q.request_id}, ${q.user_id})">💬 Chat</button>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty-state" style="padding:2rem;">Could not load quotes. Please try again.</div>';
  }
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', logout);
  });
});
