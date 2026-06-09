// dashboard.js

let dashUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  dashUser = await requireAuth();
  if (!dashUser) return;

  if (new URLSearchParams(window.location.search).get('payment') === 'success') {
    document.getElementById('successBanner').style.display = 'block';
    setTimeout(() => document.getElementById('successBanner').style.display = 'none', 6000);
  }

  await loadPurchases();
  await loadProfileForm();
});

function showTab(name, el) {
  document.querySelectorAll('.dash-sidebar a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-purchases').style.display = name === 'purchases' ? 'block' : 'none';
  document.getElementById('tab-profile').style.display = name === 'profile' ? 'block' : 'none';
}

const ICONS = { Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦', YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌' };

async function loadPurchases() {
  const el = document.getElementById('purchasesContent');
  const hidePurchasesLoader = pageLoad('Fetching your purchases...');

  const { data: purchases, error } = await window.sb
    .from('purchases')
    .select(`*, accounts(platform, country, followers), account_credentials(login_email_or_phone, password, two_factor_code, two_factor_host)`)
    .eq('user_id', dashUser.id)
    .order('purchased_at', { ascending: false });

  hidePurchasesLoader();

  if (error || !purchases?.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:40px 0;color:var(--gray-500)">
        <div style="font-size:3rem;margin-bottom:12px">📭</div>
        <p>No purchases yet.</p>
        <a href="/" class="btn-primary" style="margin-top:16px;display:inline-block">Browse Accounts</a>
      </div>`;
    return;
  }

  // Card-based layout — works perfectly on mobile and desktop
  el.innerHTML = purchases.map((p, i) => `
    <div style="background:#fff;border:1.5px solid var(--gray-100);border-radius:14px;padding:18px 20px;margin-bottom:16px;box-shadow:var(--shadow)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:1.5rem">${ICONS[p.accounts?.platform] || '🌐'}</span>
          <div>
            <div style="font-weight:800;font-size:0.98rem">${p.accounts?.platform || '—'}</div>
            <div style="font-size:0.78rem;color:var(--gray-500)">${p.accounts?.country || '—'}</div>
          </div>
        </div>
        <span class="badge ${p.is_completed ? 'complete' : 'pending'}">
          ${p.is_completed ? '✓ Completed' : '⏳ Pending'}
        </span>
      </div>

      <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--gray-700);margin-bottom:14px;flex-wrap:wrap;gap:6px">
        <span>💰 ₦${parseFloat(p.total_paid).toLocaleString()}</span>
        <span>📅 ${new Date(p.purchased_at).toLocaleDateString()}</span>
      </div>

      ${p.is_completed && p.account_credentials ? `
        <button class="reveal-btn" onclick="toggleCred('cred_${i}', this)">
          🔑 View Credentials
        </button>
        <div id="cred_${i}" style="display:none" class="cred-card">
          <div><strong>Login:</strong> ${p.account_credentials.login_email_or_phone}</div>
          <div><strong>Password:</strong> <code style="background:rgba(26,107,255,0.1);padding:2px 6px;border-radius:4px">${p.account_credentials.password}</code></div>
          ${p.account_credentials.two_factor_code
            ? `<div><strong>2FA Code:</strong> ${p.account_credentials.two_factor_code}</div>` : ''}
          ${p.account_credentials.two_factor_host
            ? `<div><strong>2FA Host:</strong> ${p.account_credentials.two_factor_host}</div>` : ''}
        </div>
      ` : p.is_completed ? `
        <p style="font-size:0.82rem;color:var(--gray-500);margin:0">
          Credentials not yet assigned. Contact support.
        </p>
      ` : ''}
    </div>
  `).join('');
}
function toggleChangePassword() {
  const section = document.getElementById('changePwSection');
  const btn = document.getElementById('togglePwBtn');
  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '✕ Cancel' : '🔑 Change Password';
}
function toggleCred(id, btn) {
  const el = document.getElementById(id);
  const isHidden = el.style.display === 'none';
  el.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? '🔒 Hide Credentials' : '🔑 View Credentials';
}

async function loadProfileForm() {
  const profile = await getProfile(dashUser.id);
  document.getElementById('pEmail').value = dashUser.email || '';
  if (profile) {
    document.getElementById('pName').value = profile.full_name || '';
    document.getElementById('pPhone').value = profile.phone || '';
    document.getElementById('pDob').value = profile.dob || '';
  }
}
async function changePassword() {
  const np = document.getElementById('newPw').value;
  const cp = document.getElementById('confirmPw').value;
  const errEl = document.getElementById('errMsgPw');
  const okEl = document.getElementById('successMsgPw');
  errEl.classList.remove('show');
  okEl.style.display = 'none';

  if (np.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.classList.add('show'); return; }
  if (np !== cp) { errEl.textContent = 'Passwords do not match.'; errEl.classList.add('show'); return; }

  const { error } = await window.sb.auth.updateUser({ password: np });
  if (error) { errEl.textContent = error.message; errEl.classList.add('show'); return; }

  okEl.textContent = '✓ Password updated successfully!';
  okEl.style.display = 'block';
  document.getElementById('newPw').value = '';
  document.getElementById('confirmPw').value = '';
  setTimeout(() => okEl.style.display = 'none', 3000);
}
async function saveProfile() {
  const name = document.getElementById('pName').value.trim();
  const phone = document.getElementById('pPhone').value.trim();
  const errEl = document.getElementById('errMsgP');
  const okEl = document.getElementById('successMsgP');
  errEl.classList.remove('show');
  okEl.style.display = 'none';

  if (!name) { errEl.textContent = 'Name is required.'; errEl.classList.add('show'); return; }

  const { error } = await window.sb.from('profiles').update({ full_name: name, phone }).eq('id', dashUser.id);
  if (error) { errEl.textContent = error.message; errEl.classList.add('show'); return; }

  okEl.textContent = '✓ Profile updated successfully!';
  okEl.style.display = 'block';
  setTimeout(() => okEl.style.display = 'none', 3000);
}