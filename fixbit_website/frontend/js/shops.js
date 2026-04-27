document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("shops-container");
  if (!container) return;

  // 1. Render Skeleton loading cards
  container.innerHTML = Array(4).fill(0).map(() => `
    <div class="shop-card" style="cursor: default;">
      <div class="skeleton skeleton-img"></div>
      <div class="shop-body">
        <div class="skeleton skeleton-text title"></div>
        <div class="skeleton skeleton-text meta"></div>
        <div class="shop-footer" style="margin-top:14px;">
          <div class="skeleton skeleton-text tag"></div>
          <div class="skeleton skeleton-text price"></div>
        </div>
      </div>
    </div>
  `).join("");

  try {
    // 2. Resolve API URL (from config, script.js API_BASE, or fallback to localhost)
    let baseUrl = 'http://localhost:5050/api';
    if (window.FIXBIT_CONFIG && window.FIXBIT_CONFIG.API_BASE_URL) {
      baseUrl = window.FIXBIT_CONFIG.API_BASE_URL;
      if (!baseUrl.endsWith('/api')) baseUrl += '/api';
    } else if (typeof API_BASE !== 'undefined') {
      baseUrl = API_BASE;
    }
      
    // Fetch location if possible
    let lat = null, lng = null;
    try {
      if (typeof getCurrentPosition === 'function') {
        const pos = await getCurrentPosition();
        lat = pos.lat;
        lng = pos.lng;
      }
    } catch(e) {
    }

    let url = `${baseUrl}/shops/nearby`;
    if (lat !== null && lng !== null) {
      url += `?lat=${lat}&lng=${lng}`;
    }

    // 3. Fetch Data
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.shops || data.shops.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); padding: 20px; font-weight: 500;">No shops found nearby at the moment.</p>';
      return;
    }

    // 4. Render Cards Dynamically
    renderShops(data.shops, container);
  } catch (err) {
    container.innerHTML = '<p style="color:var(--danger); padding: 20px; font-weight: 500;">Failed to load nearby shops. Please try again later.</p>';
  }
});

function renderShops(shops, container) {
  container.innerHTML = shops.map(shop => {
    // Dynamic styling based on category
    let badgeClass = 'badge-teal';
    if (shop.category.toLowerCase().includes('apple')) badgeClass = 'shop-tag-blue';
    if (shop.category.toLowerCase().includes('all')) badgeClass = 'shop-tag-purple';

    let finalImage = shop.image;
    if (shop.image && !shop.image.startsWith('http') && !shop.image.startsWith('assets/')) {
        if (typeof assetUrl === 'function') {
            finalImage = assetUrl(shop.image);
        } else {
            // Fallback if assetUrl is missing
            finalImage = `http://localhost:5050${shop.image.startsWith('/') ? '' : '/'}${shop.image}`;
        }
    }

    return `
      <div class="shop-card" onclick="window.location.href='login.html'">
        <div class="shop-img" style="position:relative;">
          <div style="position:absolute; top:12px; left:12px; background:var(--blue-500); color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.2); z-index:2; border:2px solid white;" title="Verified Expert">✓</div>
          <img src="${finalImage}" alt="${shop.name}" loading="lazy" onerror="this.src='assets/default-shop.png'"/>
          <div class="shop-rating">⭐ ${shop.rating}</div>
        </div>
        <div class="shop-body">
          <h3>${shop.name}</h3>
          <p class="shop-meta">📍 ${shop.distance} km &nbsp;·&nbsp; ${shop.totalReviews} reviews</p>
          <div class="shop-footer">
            <span class="shop-tag badge ${badgeClass}">${shop.category}</span>
          </div>
          
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-color);">
            <div style="display: flex; gap: 8px;">
              <button onclick="event.stopPropagation(); window.location.href='login.html'" style="background:var(--bg-surface-hover); border:1px solid var(--border-color); border-radius:8px; padding:6px 10px; cursor:pointer; font-size:.75rem; font-weight:600; color:var(--text-main); transition:all .2s;" onmouseover="this.style.background='var(--teal-50)'; this.style.color='var(--teal-700)'" onmouseout="this.style.background='var(--bg-surface-hover)'; this.style.color='var(--text-main)'">💬 Chat</button>
              <button onclick="event.stopPropagation(); window.location.href='login.html'" style="background:var(--teal-600); border:none; border-radius:8px; padding:6px 12px; cursor:pointer; font-size:.75rem; font-weight:600; color:white; transition:all .2s; box-shadow:var(--shadow-sm);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px color-mix(in srgb, var(--teal-600) 40%, transparent)'" onmouseout="this.style.transform='none'; this.style.boxShadow='var(--shadow-sm)'">Book Now</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
