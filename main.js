// main.js — home page logic

document.addEventListener('DOMContentLoaded', async () => {
  // Privacy modal
  const modal = document.getElementById('privacyModal');
  const agreeBtn = document.getElementById('agreeBtn');
  const agreeCheck = document.getElementById('agreeCheck');

  if (!sessionStorage.getItem('sv_agreed')) {
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }

  agreeCheck?.addEventListener('change', () => {
    agreeBtn.disabled = !agreeCheck.checked;
  });

  agreeBtn?.addEventListener('click', () => {
    sessionStorage.setItem('sv_agreed', '1');
    modal.classList.add('hidden');
  });

  renderAuthArea();
  await loadAccounts();
});

let allAccounts = [];

async function loadAccounts() {
  const hideLoader = pageLoad('Fetching accounts...');
  const { data, error } = await sb.from('accounts').select('*').eq('active', true).order('created_at', { ascending: false });
  if (error || !data) return;
  allAccounts = data;

  // Populate filters
  const platforms = [...new Set(data.map(a => a.platform))];
  const countries = [...new Set(data.map(a => a.country))];
  const pf = document.getElementById('platformFilter');
  const cf = document.getElementById('countryFilter');
  platforms.forEach(p => pf.innerHTML += `<option value="${p}">${p}</option>`);
  countries.forEach(c => cf.innerHTML += `<option value="${c}">${c}</option>`);

  renderAccounts(data);
  hideLoader();
  document.getElementById('searchInput').addEventListener('input', applyFilters);
  pf.addEventListener('change', applyFilters);
  cf.addEventListener('change', applyFilters);
}

function applyFilters() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const pf = document.getElementById('platformFilter').value;
  const cf = document.getElementById('countryFilter').value;
  const filtered = allAccounts.filter(a =>
    (!q || a.platform.toLowerCase().includes(q) || a.country.toLowerCase().includes(q)) &&
    (!pf || a.platform === pf) &&
    (!cf || a.country === cf)
  );
  renderAccounts(filtered);
}

const PLATFORM_ICONS = {
  Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦',
  YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌'
};

function renderAccounts(accounts) {
  const grid = document.getElementById('accountsGrid');
  if (!accounts.length) {
    grid.innerHTML = '<p style="color:var(--gray-500);grid-column:1/-1">No accounts match your filter.</p>';
    return;
  }
  grid.innerHTML = accounts.map(a => {
    const icon = PLATFORM_ICONS[a.platform] || '🌐';
    const stock = a.quantity_available > 0
      ? `<span class="meta-tag green">${a.quantity_available} in stock</span>`
      : `<span class="meta-tag orange">Out of stock</span>`;
    return `
    <div class="account-card">
      <div class="card-header">
        <div class="card-platform">${icon} ${a.platform}</div>
        <div class="card-country">🌍 ${a.country}</div>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="meta-tag">👥 ${a.followers.toLocaleString()} followers</span>
          ${stock}
        </div>
        <p class="card-desc">${a.description || ''}</p>
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty('${a.id}',-1)">−</button>
          <span class="qty-display" id="qty_${a.id}">1</span>
          <button class="qty-btn" onclick="changeQty('${a.id}',1,${a.quantity_available})">+</button>
        </div>
      </div>
      <div class="card-footer">
        <div class="card-price">₦${parseFloat(a.price_ngn).toLocaleString()} <span>/ acc</span></div>
        <button class="btn-primary" style="padding:9px 18px;font-size:0.85rem"
          onclick='addToCart(${JSON.stringify(a)}, parseInt(document.getElementById("qty_${a.id}").textContent))'
          ${a.quantity_available < 1 ? 'disabled' : ''}>
          🛒 Add to Cart
        </button>
      </div>
    </div>`;
  }).join('');
}

function changeQty(id, delta, max = 99) {
  const el = document.getElementById('qty_' + id);
  let v = parseInt(el.textContent) + delta;
  v = Math.max(1, Math.min(v, max));
  el.textContent = v;
}
