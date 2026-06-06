// checkout.js — secure payment flow via backend API

let currentUser = null;
let currentProfile = null;

const ICONS = {
  Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦',
  YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌'
};

document.addEventListener('DOMContentLoaded', async () => {
  showSkeletons();
  await initSupabase();
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

async function initPaystack() {
  if (!currentUser) return showToast('Please log in first', 'error');

  // Reset button immediately
  resetActiveBtn();

  const hideLoader = pageLoad('Preparing your order...');

  try {
    // Step 1 — Ask backend to verify prices and create pending order
    const res = await fetch('/api/initiate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: getCart(),
        userId: currentUser.id,
        email: currentUser.email
      })
    });

    const data = await res.json();
    hideLoader();

    if (data.error) return showToast(data.error, 'error');

    // Step 2 — Open Paystack with server-verified amount
    const handler = PaystackPop.setup({
      key: data.key,
      email: data.email,
      amount: data.amount, // kobo, set by server
      currency: 'NGN',
      ref: data.ref,       // ref created by server
      metadata: {
        userId: currentUser.id,
        custom_fields: [
          { display_name: 'Customer Name', variable_name: 'name', value: currentProfile?.full_name || '' },
          { display_name: 'Phone', variable_name: 'phone', value: currentProfile?.phone || '' }
        ]
      },
      callback: function(response) {
        // Step 3 — Payment done, wait for webhook to process
        // We just show success UI — webhook does the DB work
        handlePaymentDone(response.reference);
      },
      onClose: function() {
        showToast('Payment cancelled.', 'error');
      }
    });

    handler.openIframe();

  } catch (err) {
    hideLoader();
    showToast('Could not initiate payment. Try again.', 'error');
    console.error(err);
  }
}

async function handlePaymentDone(ref) {
  // Show loader while we wait for webhook to process
  const hideLoader = pageLoad('Confirming your payment...');

  // Poll purchases table until webhook records it (max 15 seconds)
  let attempts = 0;
  const maxAttempts = 15;

  const poll = setInterval(async () => {
    attempts++;

    const { data } = await window.sb
      .from('purchases')
      .select('id')
      .eq('paystack_ref', ref)
      .eq('is_completed', true)
      .single();

    if (data) {
      // Webhook has processed it
      clearInterval(poll);
      localStorage.removeItem('sv_cart');
      updateCartCount();
      hideLoader();
      window.location.href = '/dashboard?payment=success';
    } else if (attempts >= maxAttempts) {
      // Timeout — webhook may be slow but payment was made
      clearInterval(poll);
      hideLoader();
      showToast('Payment received! Your order will appear shortly on your dashboard.', 'success');
      localStorage.removeItem('sv_cart');
      updateCartCount();
      setTimeout(() => window.location.href = '/dashboard', 3000);
    }
  }, 1000); // check every second
}