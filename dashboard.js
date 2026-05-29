// dashboard.js

let dashUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  dashUser = await requireAuth();
  if (!dashUser) return;

  // Show payment success banner if redirected from checkout
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

  const { data: purchases, error } = await sb
    .from('purchases')
    .select(`*, accounts(platform, country, followers), account_credentials(login_email_or_phone, password, two_factor_code, two_factor_host)`)
    .eq('user_id', dashUser.id)
    .order('purchased_at', { ascending: false });

  if (error || !purchases?.length) {
    el.innerHTML = `
      <div style="text-align:center;padding:40px 0;color:var(--gray-500)">
        <div style="font-size:3rem;margin-bottom:12px">📭</div>
        <p>No purchases yet.</p>
        <a href="/" class="btn-primary" style="margin-top:16px;display:inline-block">Browse Accounts</a>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div style="overflow-x:auto">
      <table class="purchase-table">
        <thead>
          <tr>
            <th>Platform</th>
            <th>Country</th>
            <th>Amount Paid</th>
            <th>Date</th>
            <th>Status</th>
            <th>Credentials</th>
          </tr>
        </thead>
        <tbody>
          ${purchases.map((p, i) => `
            <tr>
              <td>${ICONS[p.accounts?.platform] || '🌐'} ${p.accounts?.platform || '—'}</td>
              <td>${p.accounts?.country || '—'}</td>
              <td>₦${parseFloat(p.total_paid).toLocaleString()}</td>
              <td>${new Date(p.purchased_at).toLocaleDateString()}</td>
              <td><span class="badge ${p.is_completed ? 'complete' : 'pending'}">${p.is_completed ? 'Completed' : 'Pending'}</span></td>
              <td>
                ${p.is_completed && p.account_credentials
                  ? `<button class="reveal-btn" onclick="toggleCred('cred_${i}')">View Credentials</button>
                     <div id="cred_${i}" style="display:none" class="cred-card">
                       <div><strong>Login:</strong> ${p.account_credentials.login_email_or_phone}</div>
                       <div><strong>Password:</strong> <code>${p.account_credentials.password}</code></div>
                       ${p.account_credentials.two_factor_code
                         ? `<div><strong>2FA Code:</strong> ${p.account_credentials.two_factor_code}</div>` : ''}
                       ${p.account_credentials.two_factor_host
                         ? `<div><strong>2FA Host:</strong> ${p.account_credentials.two_factor_host}</div>` : ''}
                     </div>`
                  : '<span style="color:var(--gray-500);font-size:0.82rem">—</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function toggleCred(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
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

async function saveProfile() {
  const name = document.getElementById('pName').value.trim();
  const phone = document.getElementById('pPhone').value.trim();
  const errEl = document.getElementById('errMsgP');
  const okEl = document.getElementById('successMsgP');
  errEl.classList.remove('show');
  okEl.style.display = 'none';

  if (!name) { errEl.textContent = 'Name is required.'; errEl.classList.add('show'); return; }

  const { error } = await sb.from('profiles').update({ full_name: name, phone }).eq('id', dashUser.id);
  if (error) { errEl.textContent = error.message; errEl.classList.add('show'); return; }

  okEl.textContent = '✓ Profile updated successfully!';
  okEl.style.display = 'block';
  setTimeout(() => okEl.style.display = 'none', 3000);
}
