// numbers.js — Server 4 & Supabase Integration with Auth Guard

let ENV = {
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    PAYSTACK_KEY: ''
};

let cachedServices = [];
let cachedCountries = [];
const TARGET_SERVER = 4;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchEnvironmentConfig();
    const searchInput = document.getElementById('numberSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = cachedServices.filter(s =>
                (s.service_name || s.name || '').toLowerCase().includes(term)
            );
            renderServer4Grid(filtered);
        });
    }
});

async function fetchEnvironmentConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Failed to load server configuration');
        ENV = await res.json();
    } catch (err) {
        console.error('Config initialization error:', err);
    }
}

// Tab Switching
function switchTab(tabName) {
    const accountsView = document.getElementById('accountsView');
    const numbersView = document.getElementById('numbersView');
    const btnAccounts = document.getElementById('btnAccountsTab');
    const btnNumbers = document.getElementById('btnNumbersTab');
    const heroFloat = document.getElementById('heroFloat');

    if (tabName === 'accounts') {
        accountsView.classList.add('active');
        numbersView.classList.remove('active');
        btnAccounts.classList.add('active');
        btnNumbers.classList.remove('active');
        if (heroFloat) {
            heroFloat.innerHTML = `
        <div class="float-card">📘 Facebook · 5.2K followers</div>
        <div class="float-card pink">📸 Instagram · 12K followers</div>
        <div class="float-card teal">🎵 TikTok · 8.5K followers</div>
      `;
        }
    } else if (tabName === 'numbers') {
        numbersView.classList.add('active');
        accountsView.classList.remove('active');
        btnNumbers.classList.add('active');
        btnAccounts.classList.remove('active');

        if (heroFloat) {
            heroFloat.innerHTML = `
        <div class="float-card teal">💬 WhatsApp · Server 4</div>
        <div class="float-card">✈️ Telegram · Paystack Secured</div>
        <div class="float-card pink">🤖 OpenAI · Live OTP</div>
      `;
        }

        fetchServicesFromSupabase();
    }
}

// Fetch Supabase Prices & XclusivePlugs Countries
async function fetchServicesFromSupabase() {
    const grid = document.getElementById('numbersGrid');
    if (!grid) return;

    grid.innerHTML = `
    <div class="loading-cards" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
      <p>⚡ Fetching live database prices & Server 4 stock...</p>
    </div>
  `;

    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
        await fetchEnvironmentConfig();
    }

    try {
        const dbPromise = fetch(`${ENV.SUPABASE_URL}/rest/v1/service_prices?is_active=eq.true&select=*`, {
            headers: {
                'apikey': ENV.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${ENV.SUPABASE_ANON_KEY}`
            }
        });

        // Change this line:
        // const countriesPromise = fetch(`https://xclusiveplugs.com/api/v1/numbers/countries?server=${TARGET_SERVER}`, ...);

        // To this (calls your secure Vercel backend proxy):
        const countriesPromise = fetch(`/api/get-countries?server=${TARGET_SERVER}`, {
            headers: { 'Accept': 'application/json' }
        }).catch(() => null);

        const [dbRes, countriesRes] = await Promise.all([dbPromise, countriesPromise]);

        if (dbRes.ok) {
            cachedServices = await dbRes.json();
        } else {
            cachedServices = getFallbackServices();
        }

        if (countriesRes && countriesRes.ok) {
            const cData = await countriesRes.json();
            cachedCountries = cData.success ? cData.data : getFallbackCountries();
        } else {
            cachedCountries = getFallbackCountries();
        }

        populateCountryDropdown(cachedCountries);
        renderServer4Grid(cachedServices);

    } catch (error) {
        console.error('Error loading Supabase prices:', error);
        cachedServices = getFallbackServices();
        cachedCountries = getFallbackCountries();
        populateCountryDropdown(cachedCountries);
        renderServer4Grid(cachedServices);
    }
}

function renderServer4Grid(services) {
    const container = document.getElementById('numbersGrid');
    if (!container) return;

    if (!services || services.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1; text-align:center;">No services available.</p>`;
        return;
    }

    container.innerHTML = services.map(s => {
        const serviceName = s.service_name || s.name || 'Service';
        const priceNgn = s.price_ngn || s.price || 2500;
        const category = s.category || 'messaging';
        const icon = s.icon || getCategoryIcon(category);

        return `
      <div class="number-card" onclick="prepareNumberPurchase('${s.id}', '${serviceName.replace(/'/g, "\\'")}', ${priceNgn})" style="cursor: pointer;">
        <div class="number-card-head">
          <div class="service-icon">${icon}</div>
          <div class="service-info">
            <h3>${serviceName}</h3>
            <span>Server 4 · Secure</span>
          </div>
        </div>
        <div class="number-card-body">
          <span class="stock-tag">● In Stock</span>
          <div class="number-price">₦${Number(priceNgn).toLocaleString()}</div>
        </div>
        <button class="btn-buy-number">
          Select Country & Pay →
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

// Require Login before opening the modal
async function prepareNumberPurchase(serviceId, serviceName, priceNgn) {
    // Use existing auth helper from auth.js to enforce login
    const user = await getUser();
    if (!user) {
        showToast('Please log in to purchase numbers', 'error');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }
    openCountrySelector(serviceId, serviceName, priceNgn, user);
}

// Country & User Modal
function openCountrySelector(serviceId, serviceName, priceNgn, user) {
    const existing = document.getElementById('countrySelectModal');
    if (existing) existing.remove();

    const modalHtml = `
    <div id="countrySelectModal" class="modal-overlay" style="display: flex;">
      <div class="modal-box" style="max-width: 450px;">
        <div class="modal-logo">🔒 Server 4 · ${serviceName}</div>
        <h2>Select Target Country</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 16px;">
          Verified Price: <strong style="color:#4ade80;">₦${Number(priceNgn).toLocaleString()}</strong>
        </p>

        <div style="margin-bottom: 16px;">
          <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:8px;">Target Region:</label>
          <select id="modalCountrySelect" style="width: 100%; padding: 12px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; font-family: inherit;">
            <option value="us">🇺🇸 United States (+1)</option>
            <option value="uk">🇬🇧 United Kingdom (+44)</option>
            <option value="ca">🇨🇦 Canada (+1)</option>
            <option value="ng">🇳🇬 Nigeria (+234)</option>
            ${cachedCountries.map(c => `<option value="${c.id}">${c.name} (+${c.calling_code || ''})</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:6px;">Your Account Email:</label>
          <input type="email" id="customerEmail" value="${user.email}" disabled style="width: 100%; padding: 12px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #94a3b8; box-sizing: border-box;" />
        </div>

        <div style="display: flex; gap: 10px;">
          <button class="btn-primary" style="background: #334155; flex: 1;" onclick="document.getElementById('countrySelectModal').remove()">Cancel</button>
          <button class="btn-primary" style="flex: 2; background: #00c853;" onclick="initiatePaystackPayment('${serviceId}', '${serviceName}', ${priceNgn}, '${user.id}', '${user.email}')">Pay via Paystack</button>
        </div>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Paystack Checkout
function initiatePaystackPayment(serviceId, serviceName, priceNgn, userId, email) {
    const countrySelect = document.getElementById('modalCountrySelect');
    const countryId = countrySelect ? countrySelect.value : 'us';

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

// Backend Handshake & Dashboard Redirect
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
                server: TARGET_SERVER,
                user_id: userId,
                email
            })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showToast(`Success! Number provisioned.`);
            // Redirect straight to dashboard purchases tab so it shows up in user's logs history
            window.location.href = '/dashboard?payment=success';
        } else {
            showToast(data.error || data.message || 'Stock error on Server 4.', 'error');
        }
    } catch (err) {
        console.error('Provisioning error:', err);
        window.location.href = '/dashboard?payment=success';
    }
}

function getFallbackServices() {
    return [
        { id: 'whatsapp', service_name: 'WhatsApp', category: 'messaging', price_ngn: 2500 },
        { id: 'telegram', service_name: 'Telegram', category: 'messaging', price_ngn: 2000 },
        { id: 'openai', service_name: 'OpenAI / ChatGPT', category: 'ai', price_ngn: 3000 },
        { id: 'instagram', service_name: 'Instagram', category: 'social', price_ngn: 1800 }
    ];
}

function getFallbackCountries() {
    return [
        { id: 'us', name: 'United States', calling_code: '1' },
        { id: 'uk', name: 'United Kingdom', calling_code: '44' },
        { id: 'ca', name: 'Canada', calling_code: '1' },
        { id: 'ng', name: 'Nigeria', calling_code: '234' }
    ];
}