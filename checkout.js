// checkout.js
const PAYSTACK_PUBLIC_KEY = window.__ENV__.PAYSTACK_KEY;

let currentUser = null;
let currentProfile = null;

const ICONS = {
  Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦',
  YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌'
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Show page skeleton immediately so page feels instant
  showSkeletons();

  // 2. Auth check
  currentUser = await requireAuth();
  if (!currentUser) return;

  // 3. Check cart
  const cart = getCart();
  if (!cart.length) { window.location.href = '/cart'; return; }

  // 4. Render items from localStorage instantly — no Supabase needed
  renderItems();

  // 5. Fetch profile in background and fill billing
  currentProfile = await getProfile(currentUser.id);
  renderBilling();
});

// ── Show skeletons while page loads ─────────────────────────────────
function showSkeletons() {
  document.getElementById('billingInfo').innerHTML = `
    <div class="sk-row medium"></div>
    <div class="sk-row short" style="margin-top:8px"></div>
    <div class="sk-row medium" style="margin-top:8px"></div>`;

  document.getElementById('checkoutItems').innerHTML = `
    <div class="sk-row full"></div>
    <div class="sk-row medium" style="margin-top:8px"></div>
    <div class="sk-row short" style="margin-top:8px"></div>`;

  document.getElementById('checkoutSummary').innerHTML = `
    <div class="sk-row full"></div>
    <div class="sk-row medium" style="margin-top:8px"></div>`;

  document.getElementById('checkoutTotal').textContent = '...';
}

// ── Render billing info ──────────────────────────────────────────────
function renderBilling() {
  const el = document.getElementById('billingInfo');
  if (!currentProfile) {
    el.innerHTML = `<p style="color:var(--red)">Profile not found. <a href="/dashboard">Complete your profile</a></p>`;
    return;
  }
  el.innerHTML = `
    <div><strong>Name:</strong> ${currentProfile.full_name || '—'}</div>
    <div><strong>Email:</strong> ${currentUser.email}</div>
    <div><strong>Phone:</strong> ${currentProfile.phone || '—'}</div>`;
}

// ── Render cart items — reads from localStorage, instant ─────────────
function renderItems() {
  const cart = getCart();

  document.getElementById('checkoutItems').innerHTML = cart.map(item => `
    <div class="summary-row">
      <span>${ICONS[item.platform] || '🌐'} ${item.platform} ×${item.qty}</span>
      <span>₦${(item.price * item.qty).toLocaleString()}</span>
    </div>`).join('');

  document.getElementById('checkoutSummary').innerHTML = cart.map(item => `
    <div class="summary-row">
      <span>${item.platform} (${item.country}) ×${item.qty}</span>
      <span>₦${(item.price * item.qty).toLocaleString()}</span>
    </div>`).join('');

  document.getElementById('checkoutTotal').textContent =
    '₦' + parseFloat(cartTotal()).toLocaleString();
}

// ── Paystack payment ─────────────────────────────────────────────────
function initPaystack() {
  const total = parseFloat(cartTotal());
  if (total <= 0) return showToast('Cart is empty', 'error');
  if (!currentUser) return showToast('Please log in first', 'error');

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: currentUser.email,
    amount: Math.round(total * 100), // kobo
    currency: 'NGN',
    ref: 'PL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    metadata: {
      userId: currentUser.id,
      custom_fields: [
        { display_name: 'Customer Name', variable_name: 'name', value: currentProfile?.full_name || '' },
        { display_name: 'Phone', variable_name: 'phone', value: currentProfile?.phone || '' }
      ]
    },
    onSuccess: function(response) {
      handlePaymentSuccess(response.reference);
    },
    onCancel: function() {
      showToast('Payment cancelled.', 'error');
      // Reset pay button if loader is active
      resetActiveBtn();
    }
  });

  handler.openIframe();
}

// ── After payment success — save to Supabase then redirect ───────────
async function handlePaymentSuccess(ref) {
  // Show full page loader while we save to DB
  const hideLoader = pageLoad('Confirming your payment...');

  try {
    const cart = getCart();

    for (const item of cart) {
      // Find an unsold credential for this account
      const { data: cred } = await sb
        .from('account_credentials')
        .select('id')
        .eq('account_id', item.id)
        .eq('is_sold', false)
        .limit(1)
        .single();

      // Insert one purchase row per quantity
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

      // Mark credential as sold
      if (cred) {
        await sb.from('account_credentials')
          .update({ is_sold: true })
          .eq('id', cred.id);
      }

      // Reduce stock count
      const newQty = Math.max(0, (item.maxQty || 1) - item.qty);
      await sb.from('accounts')
        .update({ quantity_available: newQty })
        .eq('id', item.id);
    }

    // Clear cart from localStorage
    localStorage.removeItem('sv_cart');
    updateCartCount();

    hideLoader();

    // Redirect to dashboard with success flag
    window.location.href = '/dashboard?payment=success';

  } catch (err) {
    hideLoader();
    showToast('Payment recorded but something went wrong. Contact support with ref: ' + ref, 'error');
    console.error('Payment save error:', err);
  }
}