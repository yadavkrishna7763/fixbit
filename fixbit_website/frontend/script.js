// ==================== CONFIG ====================
const API_BASE = 'https://fixbit-api.onrender.com/api';
let currentUser = null;

// ==================== HELPERS ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

function checkAuth() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!token || !user) {
    if (!window.location.pathname.includes('login.html') &&
        !window.location.pathname.includes('register') &&
        !window.location.pathname.includes('index.html')) {
      window.location.href = 'login.html';
    }
    return null;
  }
  currentUser = user;
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
    const adminEmails = ['admin@fixbit.com', 'admin@gmail.com']; // Add yours
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
  const res = await fetch(`${API_BASE}/requests`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form
  });
  const data = await res.json();
  if (data.success) {
    showToast('Request submitted!', 'success');
    return true;
  } else {
    showToast(data.message, 'error');
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
  return await apiRequest('/messages', 'POST', { request_id: requestId, receiver_id: receiverId, body });
}

async function getMessages(requestId) {
  return await apiRequest(`/messages/request/${requestId}`);
}

async function markMessagesRead(requestId) {
  return await apiRequest(`/messages/read/${requestId}`, 'PUT');
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
