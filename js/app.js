import { SUPABASE_URL, SUPABASE_ANON_KEY, PAYSTACK_PUBLIC_KEY } from './config.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let cart = JSON.parse(localStorage.getItem('shopCart')) || {};
let user = null;
let currentAuthUser = null;

// INIT
window.onload = async () => {
  await checkAuth();
  loadAccounts();
  renderCart();
  if (!localStorage.getItem('tncAccepted')) openTncModal(true);
};

// AUTH
async function checkAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (user) {
    currentAuthUser = user;
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('signupBtn').style.display = 'none';
    document.getElementById('dashboardLink').style.display = 'inline-block';
    user = user;
  }
}

document.getElementById('loginBtn').onclick = () => openModal('loginModal');
document.getElementById('signupBtn').onclick = () => openModal('signupModal');

document.getElementById('loginAction').onclick = async () => {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) alert('Login failed: ' + error.message);
  else location.reload();
};

document.getElementById('signupAction').onclick = async () => {
  const email = document.getElementById('signupEmail').value;
  const pass = document.getElementById('signupPassword').value;
  const name = document.getElementById('signupName').value;
  const dob = document.getElementById('signupDob').value;
  const phone = document.getElementById('signupPhone').value;

  if (!name || !email || !pass || !dob) return alert('Fill all required fields');
  const age = Math.floor((Date.now() - new Date(dob)) / 31536000000);
  if (age < 18) return alert('You must be 18+ to purchase accounts.');

  const { error } = await supabase.auth.signUp({
    email, password: pass, options: { emailRedirectTo: window.location.href }
  });
  if (error) return alert(error.message);

  await supabase.from('profiles').update({ name, dob, phone }).eq('email', email);
  localStorage.setItem('pendingEmail', email);
  openModal('otpModal');
};

document.getElementById('verifyOtp').onclick = async () => {
  const token = document.getElementById('otpInput').value;
  const email = localStorage.getItem('pendingEmail');
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return alert('Invalid OTP');
  alert('Account verified! Please login.');
  closeModal('otpModal');
  location.reload();
};

document.getElementById('resetAction').onclick = async () => {
  const email = document.getElementById('forgotEmail').value;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
  alert(error ? error.message : 'Reset link sent to email.');
};

// CATALOG
async function loadAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').eq('is_active', true);
  if (error) return console.error(error);
  document.getElementById('accountsGrid').innerHTML = data.map(a => `
    <div class="card">
      <h3>${a.platform}</h3>
      <div class="meta">🌍 ${a.country} | 👥 ${a.follower_count.toLocaleString()} followers</div>
      <div class="meta">📦 ${a.quantity_available} available</div>
      <div class="price">$${a.price.toFixed(2)}</div>
      <div class="actions">
        <button class="btn secondary" onclick="addToCart('${a.id}')">Add to Cart</button>
      </div>
    </div>
  `).join('');
}

// CART
window.addToCart = (id) => {
  cart[id] = (cart[id] || 0) + 1;
  localStorage.setItem('shopCart', JSON.stringify(cart));
  renderCart();
};

function renderCart() {
  const section = document.getElementById('cartSection');
  const container = document.getElementById('cartItems');
  if (Object.keys(cart).length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  let html = '', total = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const acc = document.querySelector(`.card h3`).closest('.card')?.getAttribute('data-id') || id; // Simplified fetch
    html += `<div class="cart-item"><span>Account ID: ${id}</span><div class="qty-control">
      <button class="qty-btn" onclick="updateQty('${id}', -1)">-</button>
      <span>${qty}</span>
      <button class="qty-btn" onclick="updateQty('${id}', 1)">+</button>
      <button class="qty-btn" onclick="removeItem('${id}')" style="margin-left:5px;">🗑</button>
    </div></div>`;
  }
  container.innerHTML = html;
  document.getElementById('cartTotal').textContent = `Total: $${total.toFixed(2)}`;
}

window.updateQty = (id, delta) => {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  localStorage.setItem('shopCart', JSON.stringify(cart));
  renderCart();
};

window.removeItem = (id) => { delete cart[id]; localStorage.setItem('shopCart', JSON.stringify(cart)); renderCart(); };

// CHECKOUT
window.initiateCheckout = async () => {
  if (!user) return alert('Please login to checkout.');
  if (!document.getElementById('tncAgree').checked) return alert('You must agree to the Terms & Conditions.');

  let total = 0, items = [];
  for (const [id, qty] of Object.entries(cart)) total += qty * 99; // Replace with real price fetch
  const ref = 'ref_' + Math.random().toString(36).substr(2, 9);

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: user.email,
    amount: total * 100,
    currency: 'NGN', // Change as needed
    ref: ref,
    callback: async (response) => {
      alert('Payment Successful! Ref: ' + response.reference);
      localStorage.removeItem('shopCart');
      cart = {};
      renderCart();
      // In production: Verify via webhook, mark purchase true, deliver credentials
    },
    onClose: () => alert('Transaction cancelled.')
  });
  handler.openIframe();
};

// MODALS
window.openModal = (id) => document.getElementById(id).classList.add('active');
window.closeModal = (id) => document.getElementById(id).classList.remove('active');
window.openTncModal = (force) => {
  if (force) localStorage.setItem('tncAccepted', '1');
  openModal('tncModal');
};
window.openForgotModal = () => openModal('forgotModal');
