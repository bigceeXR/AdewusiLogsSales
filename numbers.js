// numbers.js — Grouped Service Cards + Dynamic Country-Specific Pricing Modal

let ENV = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', PAYSTACK_KEY: '' };
let groupedServicesMap = {}; // Maps service_id -> { name, categories, countries: [{country_id, country_name, price_ngn}] }
let currentSelectedService = null;

document.addEventListener('DOMContentLoaded', async () => {
    await fetchEnvironmentConfig();

    const searchInput = document.getElementById('numberSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filteredKeys = Object.keys(groupedServicesMap).filter(id =>
                id.toLowerCase().includes(term) || groupedServicesMap[id].name.toLowerCase().includes(term)
            );
            renderGroupedServicesGrid(filteredKeys);
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
        loadAndGroupDatabasePrices();
    }
}

// 1. Fetch from number_country_prices and group by service_id
async function loadAndGroupDatabasePrices() {
    const grid = document.getElementById('numbersGrid');
    if (!grid) return;

    grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
      <p>⚡ Loading services and regional pricing from database...</p>
    </div>
  `;

    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
        await fetchEnvironmentConfig();
    }

    try {
        const dbRes = await fetch(`${ENV.SUPABASE_URL}/rest/v1/number_country_prices?is_active=eq.true&select=*`, {
            headers: {
                'apikey': ENV.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${ENV.SUPABASE_ANON_KEY}`
            }
        });

        if (!dbRes.ok) throw new Error('Failed to query database pricing');
        const rows = await dbRes.json();

        if (!rows || rows.length === 0) {
            grid.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1; text-align:center;">No service pricing configured in database table.</p>`;
            return;
        }

        // Group rows by service_id
        groupedServicesMap = {};
        rows.forEach(r => {
            const sId = r.service_id.toLowerCase();
            if (!groupedServicesMap[sId]) {
                groupedServicesMap[sId] = {
                    service_id: sId,
                    name: r.service_name || sId.charAt(0).toUpperCase() + sId.slice(1),
                    countries: []
                };
            }
            groupedServicesMap[sId].countries.push({
                country_id: r.country_id,
                country_name: r.country_name || r.country_id.toUpperCase(),
                price_ngn: Number(r.price_ngn)
            });
        });

        renderGroupedServicesGrid(Object.keys(groupedServicesMap));

    } catch (error) {
        console.error('Database grouping error:', error);
        grid.innerHTML = `<p style="color:var(--red); text-align:center; grid-column:1/-1;">Error connecting to database. Check RLS policies.</p>`;
    }
}

// 2. Render One Card Per Service
function renderGroupedServicesGrid(serviceKeys) {
    const container = document.getElementById('numbersGrid');
    if (!container) return;

    if (!serviceKeys || serviceKeys.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1; text-align:center;">No matching services available.</p>`;
        return;
    }

    container.innerHTML = serviceKeys.map(key => {
        const service = groupedServicesMap[key];
        const countryCount = service.countries.length;
        const minPrice = Math.min(...service.countries.map(c => c.price_ngn));

        return `
      <div class="number-card" style="cursor: pointer;" onclick="openServiceCountryModal('${service.service_id}')">
        <div class="number-card-head">
          <div class="service-icon">📱</div>
          <div class="service-info">
            <h3>${service.name}</h3>
            <span>${countryCount} Region${countryCount > 1 ? 's' : ''} Available</span>
          </div>
        </div>
        <div class="number-card-body">
          <span class="stock-tag">● Server 4 Online</span>
          <div class="number-price" style="font-size:1.1rem; font-weight:800; color:#4ade80; margin-top:6px;">
            From ₦${minPrice.toLocaleString()}
          </div>
        </div>
        <button class="btn-buy-number" style="margin-top:12px;">
          Select Country & Buy →
        </button>
      </div>
    `;
    }).join('');
}

// 3. Open Modal for Country Selection & Dynamic Pricing
async function openServiceCountryModal(serviceId) {
    const user = await getUser();
    if (!user) {
        showToast('Please log in to purchase numbers', 'error');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }

    const service = groupedServicesMap[serviceId];
    if (!service) return;
    currentSelectedService = service;

    const existing = document.getElementById('countrySelectModal');
    if (existing) existing.remove();

    const defaultCountry = service.countries[0];

    const modalHtml = `
    <div id="countrySelectModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; align-items: center; justify-content: center; padding: 20px;">
      <div class="modal-box" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; width: 100%; max-width: 440px; color: #fff;">
        <div style="font-size:0.85rem; color:#38bdf8; font-weight:700; margin-bottom:6px;">SERVER 4 · VIRTUAL NUMBER</div>
        <h2 style="font-size:1.4rem; margin-bottom:12px;">${service.name}</h2>
        
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 16px;">
          Price for region: <strong id="dynamicPriceDisplay" style="color:#4ade80; font-size:1.2rem;">₦${defaultCountry.price_ngn.toLocaleString()}</strong>
        </p>

        <div style="margin-bottom: 16px;">
          <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:8px;">Choose Target Country:</label>
          <select id="modalCountrySelect" onchange="updateSelectedCountryPrice()" style="width: 100%; padding: 12px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; color: #fff; font-family: inherit;">
            ${service.countries.map(c => `<option value="${c.country_id}" data-price="${c.price_ngn}">${c.country_name} (₦${c.price_ngn.toLocaleString()})</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:6px;">Account Email:</label>
          <input type="email" value="${user.email}" disabled style="width: 100%; padding: 12px; background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #94a3b8; box-sizing: border-box;" />
        </div>

        <div style="display: flex; gap: 10px;">
          <button type="button" style="background: #334155; color:#fff; border:none; padding:12px; border-radius:10px; flex: 1; cursor:pointer;" onclick="document.getElementById('countrySelectModal').remove()">Cancel</button>
          <button type="button" id="proceedPayBtn" style="background: #22c55e; color:#fff; border:none; padding:12px; border-radius:10px; flex: 2; font-weight:700; cursor:pointer;" onclick="initiatePaystackCheckout('${user.id}', '${user.email}')">Pay ₦${defaultCountry.price_ngn.toLocaleString()} via Paystack</button>
        </div>
      </div>
    </div>
  `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 4. Update Modal Price on Country Change
function updateSelectedCountryPrice() {
    const select = document.getElementById('modalCountrySelect');
    const priceDisplay = document.getElementById('dynamicPriceDisplay');
    const payBtn = document.getElementById('proceedPayBtn');
    if (!select || !priceDisplay) return;

    const selectedOption = select.options[select.selectedIndex];
    const price = Number(selectedOption.getAttribute('data-price'));

    priceDisplay.textContent = `₦${price.toLocaleString()}`;
    if (payBtn) payBtn.textContent = `Pay ₦${price.toLocaleString()} via Paystack`;
}

// 5. Launch Paystack Popup
function initiatePaystackCheckout(userId, email) {
    const select = document.getElementById('modalCountrySelect');
    if (!select || !currentSelectedService) return;

    const countryId = select.value;
    const targetCountryObj = currentSelectedService.countries.find(c => c.country_id === countryId);
    const priceNgn = targetCountryObj ? targetCountryObj.price_ngn : 2500;

    if (!ENV.PAYSTACK_KEY) {
        showToast('Paystack public key missing', 'error');
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
                { display_name: "Service", variable_name: "service_id", value: currentSelectedService.service_id },
                { display_name: "Country", variable_name: "country_id", value: countryId }
            ]
        },
        callback: function (response) {
            verifyAndProvisionNumber(response.reference, currentSelectedService.service_id, countryId, userId, email);
        },
        onClose: function () {
            showToast('Payment cancelled', 'error');
        }
    });

    handler.openIframe();
}

// 6. Backend Handshake & Provision
async function verifyAndProvisionNumber(reference, serviceId, countryId, userId, email) {
    showToast('Payment successful! Ordering from Server 4...');

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
            showToast('Number provisioned successfully!');
            window.location.href = '/dashboard?payment=success';
        } else {
            console.error('Provisioning Error Details:', data);
            showToast(data.error || 'Stock error on Server 4.', 'error');
        }
    } catch (err) {
        console.error('Network error during provisioning:', err);
        window.location.href = '/dashboard?payment=success';
    }
}