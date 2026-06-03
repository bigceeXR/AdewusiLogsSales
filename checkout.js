// checkout.js
// Paystack key is loaded by supabase.js from /api/config
function getPaystackKey() { return window.__PAYSTACK_KEY__; }

let currentUser = null;
let currentProfile = null;

const ICONS = {
  Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦',
  YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌'
};

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  showSkeletons();
  currentUser = await requireAuth();
  if (!currentUser) return;
  const cart = getCart();
  if (!cart.length) { window.location.href = '/cart'; return; }
  renderItems();
  currentProfile = await getProfile(currentUser.id);
  renderBilling();
});

function showSkeletons() {
  document.getElementById('billingInfo').innerHTML = `
    <div class="sk-row medium"></div>
    <div class="sk-row short" style="margin-top:8px"></div>
    <div class="sk-row medium" style="margin-top:8px"></div>`;
  document.getElementById('checkoutItems').innerHTML = `
    <div class="sk-row full"></div>
    <div class="sk-row medium" style="margin-top:8px"></div>`;
  document.getElementById('checkoutSummary').innerHTML = `
    <div class="sk-row full"></div>
    <div class="sk-row medium" style="margin-top:8px"></div>`;
  document.getElementById('checkoutTotal').textContent = '...';
}

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

function initPaystack() {
  const total = parseFloat(cartTotal());
  if (total <= 0) return showToast('Cart is empty', 'error');
  if (!currentUser) return showToast('Please log in first', 'error');

  // Reset button — Paystack iframe takes over from here
  resetActiveBtn();

  // Paystack v1 inline.js uses `callback` and `onClose`
  const handler = PaystackPop.setup({
    key: getPaystackKey(),
    email: currentUser.email,
    amount: Math.round(total * 100),
    currency: 'NGN',
    ref: 'PL_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    metadata: {
      userId: currentUser.id,
      custom_fields: [
        { display_name: 'Customer Name', variable_name: 'name', value: currentProfile?.full_name || '' },
        { display_name: 'Phone', variable_name: 'phone', value: currentProfile?.phone || '' }
      ]
    },
    callback: function(response) {
      handlePaymentSuccess(response.reference);
    },
    onClose: function() {
      showToast('Payment cancelled.', 'error');
    }
  });

  handler.openIframe();
}

async function handlePaymentSuccess(ref) {
  const hideLoader = pageLoad('Confirming your payment...');

  try {
    const cart = getCart();

    for (const item of cart) {
      // Find unsold credential
      const { data: cred } = await sb
        .from('account_credentials')
        .select('id')
        .eq('account_id', item.id)
        .eq('is_sold', false)
        .limit(1)
        .single();

      // Insert purchase rows
      for (let q = 0; q < item.qty; q++) {
        await window.sb.from('purchases').insert({
          user_id: currentUser.id,
          account_id: item.id,
          credential_id: cred?.id || null,
          quantity: 1,
          total_paid: item.price,
          paystack_ref: ref,
          is_completed: true
        });
      }

      // Mark credential sold
      if (cred) {
        await window.sb.from('account_credentials')
          .update({ is_sold: true })
          .eq('id', cred.id);
      }

      // Reduce stock
      const newQty = Math.max(0, (item.maxQty || 1) - item.qty);
      await window.sb.from('accounts')
        .update({ quantity_available: newQty })
        .eq('id', item.id);
    }

    // Clear cart
    localStorage.removeItem('sv_cart');
    updateCartCount();

    hideLoader();
    window.location.href = '/dashboard?payment=success';

  } catch (err) {
    hideLoader();
    console.error('Payment save error:', err);
    showToast('Payment received but something went wrong. Contact support. Ref: ' + ref, 'error');
  }
}
