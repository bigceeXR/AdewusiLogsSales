// checkout.js — Vercel injects PAYSTACK_KEY at build time via build.js
const PAYSTACK_PUBLIC_KEY = window.__ENV__.PAYSTACK_KEY;

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  const cart = getCart();
  if (!cart.length) { window.location.href = 'cart'; return; }

  currentProfile = await getProfile(currentUser.id);
  renderBilling();
  renderItems();
});

function renderBilling() {
  const el = document.getElementById('billingInfo');
  if (!currentProfile) {
    el.innerHTML = `<p style="color:var(--red)">Profile not found. <a href="/dashboard">Complete your profile</a></p>`;
    return;
  }
  el.innerHTML = `
    <div><strong>Name:</strong> ${currentProfile.full_name || '—'}</div>
    <div><strong>Email:</strong> ${currentUser.email}</div>
    <div><strong>Phone:</strong> ${currentProfile.phone || '—'}</div>
  `;
}

function renderItems() {
  const cart = getCart();
  const ICONS = { Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦', YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌' };

  document.getElementById('checkoutItems').innerHTML = cart.map(item => `
    <div class="summary-row">
      <span>${ICONS[item.platform] || '🌐'} ${item.platform} ×${item.qty}</span>
      <span>$${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');

  document.getElementById('checkoutSummary').innerHTML = cart.map(item => `
    <div class="summary-row">
      <span>${item.platform} (${item.country}) ×${item.qty}</span>
      <span>$${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');

  document.getElementById('checkoutTotal').textContent = '₦' + parseFloat(cartTotal()).toLocaleString();
}

function initPaystack() {
  const total = parseFloat(cartTotal());
  if (total <= 0) return showToast('Cart is empty', 'error');

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: currentUser.email,
    amount: Math.round(total * 100),
    currency: 'NGN',
    ref: 'PL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    metadata: { userId: currentUser.id, cart: JSON.stringify(getCart()) },
    onSuccess: function(response) {
      handlePaymentSuccess(response.reference);
    },
    onCancel: function() {
      showToast('Payment cancelled.', 'error');
    }
  });
  handler.openIframe();
}

async function handlePaymentSuccess(ref) {
  const payBtn = document.getElementById('payBtn');
  payBtn.disabled = true;
  payBtn.textContent = 'Processing...';

  const cart = getCart();

  for (const item of cart) {
    const { data: cred } = await sb
      .from('account_credentials')
      .select('id')
      .eq('account_id', item.id)
      .eq('is_sold', false)
      .limit(1)
      .single();

    for (let q = 0; q < item.qty; q++) {
      await sb.from('purchases').insert({
        user_id: currentUser.id,
        account_id: item.id,
        credential_id: cred?.id || null,
        quantity: 1,
        total_paid: item.price,
        paystack_ref: ref,
        is_completed: true
      });
    }

    if (cred) {
      await sb.from('account_credentials').update({ is_sold: true }).eq('id', cred.id);
    }

    await sb.from('accounts')
      .update({ quantity_available: sb.rpc('decrement', { x: item.qty }) })
      .eq('id', item.id);
  }

  localStorage.removeItem('sv_cart');
  window.location.href = '/dashboard?payment=success';
}
