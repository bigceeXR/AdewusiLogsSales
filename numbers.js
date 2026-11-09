// numbers.js — Live Server 4 Data + number_country_prices Overlay

let ENV = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', PAYSTACK_KEY: '' };
let server4Services = [];
let server4Countries = [];
let countryPricesMap = {}; // Maps service_id -> { country_id -> price_ngn }

document.addEventListener('DOMContentLoaded', async () => {
    await fetchEnvironmentConfig();
    const searchInput = document.getElementById('numberSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = server4Services.filter(s =>
                (s.name || s.service_name || '').toLowerCase().includes(term)
            );
            renderServer4Grid(filtered);
        });
    }
});

async function fetchEnvironmentConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Config load failed');
        ENV = await res.json();
    } catch (err) {
        console.error('Config error:', err);
    }
}

// Tab Switching
function switchTab(tabName) {
    const accountsView = document.getElementById('accountsView');
    const numbersView = document.getElementById('numbersView');
    const btnAccounts = document.getElementById('btnAccountsTab');
    const btnNumbers = document.getElementById('btnNumbersTab');

    if (tabName === 'accounts') {
        accountsView.classList.add('active');
        numbersView.classList.remove('active');
        btnAccounts.classList.add('active');
        btnNumbers.classList.remove('active');
    } else if (tabName === 'numbers') {
        numbersView.classList.add('active');
        accountsView.classList.remove('active');
        btnNumbers.classList.add('active');
        btnAccounts.classList.remove('active');
        fetchServer4AndDatabasePrices();
    }
}

// Fetch live Server 4 items and match with number_country_prices
async function fetchServer4AndDatabasePrices() {
    const grid = document.getElementById('numbersGrid');
    if (!grid) return;

    grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
      <p>⚡ Connecting to Server 4 & loading country pricing...</p>
    </div>
  `;

    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
        await fetchEnvironmentConfig();
    }

    try {
        const server4Promise = fetch('/api/get-server4-data').then(res => res.json());

        const countryPricesPromise = fetch(`${ENV.SUPABASE_URL}/rest/v1/number_country_prices?is_active=eq.true&select=*`, {
            headers: { 'apikey': ENV.SUPABASE_ANON_KEY, 'Authorization': `Bearer ${ENV.SUPABASE_ANON_KEY}` }
        }).then(res => res.json()).catch(() => []);

        const [server4Data, dbCountryPrices] = await Promise.all([
            server4Promise, countryPricesPromise
        ]);

        server4Services = server4Data.success ? server4Data.services : [];
        server4Countries = server4Data.success ? server4Data.countries : [];

        // Map database country-specific prices
        countryPricesMap = {};
        dbCountryPrices.forEach(p => {
            if (!countryPricesMap[p.service_id]) countryPricesMap[p.service_id] = {};
            countryPricesMap[p.service_id][p.country_id] = p.price_ngn;
        });

        populateCountryDropdown(server4Countries);
        renderServer4Grid(server4Services);

    } catch (error) {
        console.error('Error loading inventory:', error);
        grid.innerHTML = `<p style="color:var(--red); text-align:center; grid-column:1/-1;">Failed to load Server 4 data. Please refresh.</p>`;
    }
}

function renderServer4Grid(services) {
    const container = document.getElementById('numbersGrid');
    if (!container) return;

    if (!services || services.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1; text-align:center;">No services online from Server 4.</p>`;
        return;
    }

    container.innerHTML = services.map(s => {
        const serviceId = s.id || s.code;
        const serviceName = s.name || s.service_name || 'Service';
        const category = s.category || 'messaging';
        const icon = getCategoryIcon(category);

        return `
      <div class="number-card" onclick="prepareNumberPurchase('${serviceId}', '${serviceName.replace(/'/g, "\\'")}')" style="cursor: pointer;">
        <div class="number-card-head">
          <div class="service-icon">${icon}</div>
          <div class="service-info">
            <h3>${serviceName}</h3>
            <span>Server 4 · Live Stock</span>
          </div>
        </div>
        <div class="number-card-body">
          <span class="stock-tag">● In Stock</span>
          <div class="number-price" style="font-size:1rem; color:#94a3b8;">Select country for price</div>
        </div>
        <button class="btn-buy-number">
          Choose Country →
        </button>
      </div>
    `;
    }).join('');
}

function getCategoryIcon(category) {
    switch ((category || '').toLowerCase()) {
        case 'messaging': return '💬';
        case 'social': return '📸';
        case 'ai': return '🤖';
        case 'finance': return '💳';
        default: return '⚡';
    }
}

function populateCountryDropdown(countries) {
    const select = document.getElementById('numberCountryFilter');
    if (!select) return;
    let html = '<option value="">🌍 All Countries (Server 4)</option>';
    countries.forEach(c => {
        html += `<option value="${c.id}">${c.name} (+${c.calling_code || ''})</option>`;
    });
    select.innerHTML = html;
}

async function prepareNumberPurchase(serviceId, serviceName) {
    const user = await getUser();
    if (!user) {
        showToast('Please log in to purchase numbers', 'error');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }
    openCountrySelector(serviceId, serviceName, user);
}

function openCountrySelector(serviceId, serviceName, user) {
    const existing = document.getElementById('countrySelectModal');
    if (existing) existing.remove();

    const defaultCountry = server4Countries[0]?.id || 'us';
    const currentPrice = countryPricesMap[serviceId]?.[defaultCountry] || 2500; // fallback if missing in DB

    const modalHtml = `
    <div id="countrySelectModal" class="modal-overlay" style="display: flex;">
      <div class="modal-box" style="max-width: 450px;">
        <div class="modal-logo">🔒 Server 4 · ${serviceName}</div>
        <h2>Select Target Country</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 16px;">
          Database Price: <strong id="dynamicPriceDisplay" style="color:#4ade80; font-size:1.1rem;">₦${Number(currentPrice).toLocaleString()}</strong>
        </p>

        <div style="margin-bottom: 16px;">
          <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:8px;">Target Region:</label>
          <select id="modalCountrySelect" onchange="updateModalPrice('${serviceId}')" style="width: 100%; padding: 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-family: inherit;">
            ${server4Countries.map(c => `<option value="${c.id}">${c.name} (+${c.calling_code || ''})</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:6px;">Your Account Email:</label>
          <input type="email" id="customerEmail" value="${user.email}" disabled style="width: 100%; padding: 12px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #94a3b8; box-sizing: border-box;" />
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn-primary" style="background: #334155; flex: 1;" onclick="document.getElementById('countrySelectModal').remove()">Cancel</button>
          <button class="btn-primary" id="proceedPayBtn" style="flex: 2; background: #00c853;" onclick="initiatePaystackPayment('${serviceId}', '${serviceName}', '${user.id}', '${user.email}')">Pay ₦${Number(currentPrice).toLocaleString()} via Paystack</button>
        </div>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function updateModalPrice(serviceId) {
    const countrySelect = document.getElementById('modalCountrySelect');
    const priceDisplay = document.getElementById('dynamicPriceDisplay');
    const payBtn = document.getElementById('proceedPayBtn');

    if (!countrySelect || !priceDisplay) return;

    const selectedCountry = countrySelect.value;
    const price = countryPricesMap[serviceId]?.[selectedCountry] || 2500;

    priceDisplay.textContent = `₦${Number(price).toLocaleString()}`;
    if (payBtn) payBtn.textContent = `Pay ₦${Number(price).toLocaleString()} via Paystack`;
}

function initiatePaystackPayment(serviceId, serviceName, userId, email) {
    const countrySelect = document.getElementById('modalCountrySelect');
    const countryId = countrySelect ? countrySelect.value : 'us';
    const priceNgn = countryPricesMap[serviceId]?.[countryId] || 2500;

    if (!ENV.PAYSTACK_KEY) {
        showToast('Paystack key not loaded. Refresh page.', 'error');
        return;
    }

    document.getElementById('countrySelectModal').remove();
    const amountInKobo = Math.round(priceNgn * 100);

    let handler = PaystackPop.setup({
        key: ENV.PAYSTACK_KEY,
        email: email,
        amount: amountInKobo,
        currency: 'NGN',
        metadata: {
            userId: userId,
            custom_fields: [
                { display_name: "Service", variable_name: "service_id", value: serviceId },
                { display_name: "Server", variable_name: "server", value: "Server 4" },
                { display_name: "Country", variable_name: "country_id", value: countryId }
            ]
        },
        callback: function (response) {
            verifyAndProvisionNumber(response.reference, serviceId, countryId, userId, email);
        },
        onClose: function () {
            showToast('Payment cancelled.', 'error');
        }
    });

    handler.openIframe();
}

async function verifyAndProvisionNumber(reference, serviceId, countryId, userId, email) {
    showToast('Payment verified! Provisioning from Server 4...');

    try {
        const res = await fetch('/api/verify-number-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reference,
                service_id: serviceId,
                country_id: countryId,
                server: 4,
                user_id: userId,
                email
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showToast('Success! Number provisioned.');
            window.location.href = '/dashboard?payment=success';
        } else {
            showToast(data.error || data.message || 'Stock error on Server 4.', 'error');
        }
    } catch (err) {
        console.error('Provisioning error:', err);
        window.location.href = '/dashboard?payment=success';
    }
}