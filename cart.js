// cart.js — localStorage cart helpers

function getCart() {
  return JSON.parse(localStorage.getItem('sv_cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('sv_cart', JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (!el) return;
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.qty, 0);
  el.textContent = total;
}

function addToCart(account, qty = 1) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.id === account.id);
  if (idx > -1) {
    cart[idx].qty = Math.min(cart[idx].qty + qty, account.quantity_available);
  } else {
    cart.push({ id: account.id, platform: account.platform, country: account.country,
      price: account.price_usd, qty, maxQty: account.quantity_available });
  }
  saveCart(cart);
  showToast(`${account.platform} added to cart ✓`, 'success');
}

function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id));
}

function cartTotal() {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0).toFixed(2);
}

// Init count on page load
document.addEventListener('DOMContentLoaded', updateCartCount);
