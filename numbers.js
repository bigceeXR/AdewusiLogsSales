// numbers.js — Fully Supabase-Driven + Server 4 Inventory Integration

let ENV = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', PAYSTACK_KEY: '' };
let activeDbPrices = []; // Rows loaded directly from 'number_country_prices'
let server4Stock = {};   // Live stock status from Server 4 backend proxy

document.addEventListener('DOMContentLoaded', async () => {
    await fetchEnvironmentConfig();

    const searchInput = document.getElementById('numberSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = activeDbPrices.filter(p =>
                (p.service_id || '').toLowerCase().includes(term) ||
                (p.country_name || '').toLowerCase().includes(term)
            );
            renderDatabaseServicesGrid(filtered);
        });
    }
});

async function fetchEnvironmentConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Failed to load configuration');
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
        loadServicesFromDatabaseAndServer4();
    }
}

// 1. Fetch configured services from Supabase & verify live stock on Server 4
async function loadServicesFromDatabaseAndServer4() {
    const grid = document.getElementById('numbersGrid');
    if (!grid) return;

    grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8;">
      <p>⚡ Fetching active services and dynamic prices from database...</p>
    </div>
  `;

    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
        await fetchEnvironmentConfig();
    }

    try {
        // Read only what is configured in your number_country_prices table
        const dbRes = await fetch(`${ENV.SUPABASE_URL}/rest/v1/number_country_prices?is_active=eq.true&select=*`, {
            headers: {
                'apikey': ENV.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${ENV.SUPABASE_ANON_KEY}`
            }
        });

        if (!dbRes.ok) throw new Error('Failed to fetch pricing from database');
        activeDbPrices = await dbRes.json();

        if (!activeDbPrices || activeDbPrices.length === 0) {
            grid.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1; text-align:center;">No services configured in database table.</p>`;
            return;
        }

        // Call serverless proxy to get Server 4 stock for these items
        const stockRes = await fetch('/api/get-server4-data').then(r => r.json()).catch(() => ({ success: false }));
        server4Stock = stockRes.success ? stockRes.stockMap || {} : {};

        renderDatabaseServicesGrid(activeDbPrices);

    } catch (error) {
        console.error('Error loading DB services:', error);
        grid.innerHTML = `<p style="color:var(--red); text-align:center; grid-column:1/-1;">Error loading database services. Check database connection.</p>`;
    }
}

// 2. Render Grid directly from Supabase DB rows
function renderDatabaseServicesGrid(items) {
    const container = document.getElementById('numbersGrid');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; grid-column:1/-1; text-align:center;">No matching services found.</p>`;
        return;
    }

    container.innerHTML = items.map(item => {
        const serviceTitle = item.service_id.toUpperCase();
        const countryName = item.country_name || item.country_id.toUpperCase();
        const price = Number(item.price_ngn).toLocaleString();
        const stockKey = `${item.service_id}_${item.country_id}`;
        const stockCount = server4Stock[stockKey] ?? 'Available';

        return `
      <div class="number-card">
        <div class="number-card-head">
          <div class="service-icon">📱</div>
          <div class="service-info">
            <h3>${serviceTitle}</h3>
            <span>Region: ${countryName}</span>
          </div>
        </div>
        <div class="number-card-body">
          <span class="stock-tag">● Stock: ${stockCount}</span>
          <div class="number-price" style="font-size:1.2rem; font-weight:800; color:#4ade80; margin-top:8px;">
            ₦${price}
          </div>
        </div>
        <button class="btn-buy-number" style="margin-top:12px;" onclick="checkoutNumberService('${item.service_id}', '${item.country_id}', ${item.price_ngn}, '${countryName}')">
          Buy Now →
        </button>
      </div>
    `;
    }).join('');
}

// 3. Trigger Paystack payment using the Supabase price
async function checkoutNumberService(serviceId, countryId, priceNgn, countryName) {
    const user = await getUser();
    if (!user) {
        showToast('Please log in to purchase numbers', 'error');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }

    if (!ENV.PAYSTACK_KEY) {
        showToast('Payment system not loaded. Refreshing...', 'error');
        return;
    }

    const amountInKobo = Math.round(Number(priceNgn) * 100);

    let handler = PaystackPop.setup({
        key: ENV.PAYSTACK_KEY,
        email: user.email,
        amount: amountInKobo,
        currency: 'NGN',
        metadata: {
            userId: user.id,
            custom_fields: [
                { display_name: "Service", variable_name: "service_id", value: serviceId },
                { display_name: "Country", variable_name: "country_id", value: countryId }
            ]
        },
        callback: function (response) {
            verifyAndProvisionNumber(response.reference, serviceId, countryId, user.id, user.email);
        },
        onClose: function () {
            showToast('Payment cancelled.', 'error');
        }
    });

    handler.openIframe();
}

// 4. Verify Paystack & Provision line from Server 4
async function verifyAndProvisionNumber(reference, serviceId, countryId, userId, email) {
    showToast('Payment received! Reserving number from Server 4...');

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
            showToast('Success! Redirecting to Dashboard for OTP...');
            window.location.href = '/dashboard?payment=success';
        } else {
            console.error('Provisioning Error:', data);
            showToast(data.error || 'Server 4 stock error. Contact support.', 'error');
        }
    } catch (err) {
        console.error('Network Error:', err);
        showToast('Verification failed. Please check Dashboard.', 'error');
    }
}