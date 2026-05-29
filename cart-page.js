// cart-page.js

const PLATFORM_ICONS = {
  Facebook:'📘', Instagram:'📸', TikTok:'🎵', 'Twitter/X':'🐦',
  YouTube:'▶️', Snapchat:'👻', LinkedIn:'💼', Pinterest:'📌'
};

document.addEventListener('DOMContentLoaded', async () => {
  renderAuthArea();
  renderCart();
});

function renderCart() {
  const cart = getCart();
  const layout = document.getElementById('cartLayout');
  const empty = document.getElementById('emptyCart');

  if (!cart.length) {
    layout.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  layout.style.display = 'grid';
  empty.style.display = 'none';

  const list = document.getElementById('cartItemsList');
  const summaryRows = document.getElementById('summaryRows');

  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div style="font-size:2rem">${PLATFORM_ICONS[item.platform] || '🌐'}</div>
      <div class="cart-item-info">
        <h4>${item.platform} — ${item.country}</h4>
        <p>$${parseFloat(item.price).toFixed(2)} × ${item.qty} account(s)</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="qty-row">
          <button class="qty-btn" onclick="adjustQty('${item.id}',-1)">−</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" onclick="adjustQty('${item.id}',1,${item.maxQty})">+</button>
        </div>
        <strong style="color:var(--blue);min-width:64px;text-align:right">$${(item.price * item.qty).toFixed(2)}</strong>
        <button class="cart-remove" onclick="removeItem('${item.id}')">✕ Remove</button>
      </div>
    </div>
  `).join('');

  summaryRows.innerHTML = cart.map(item => `
    <div class="summary-row">
      <span>${item.platform} ×${item.qty}</span>
      <span>$${(item.price * item.qty).toFixed(2)}</span>
    </div>
  `).join('');

  document.getElementById('totalAmount').textContent = '$' + cartTotal();
}

function adjustQty(id, delta, max = 99) {
  const cart = getCart();
  const idx = cart.findIndex(i => i.id === id);
  if (idx === -1) return;
  cart[idx].qty = Math.max(1, Math.min(cart[idx].qty + delta, max));
  saveCart(cart);
  renderCart();
}

function removeItem(id) {
  removeFromCart(id);
  renderCart();
  showToast('Item removed from cart');
}

async function proceedCheckout() {
  const user = await getUser();
  if (!user) {
    window.location.href = 'login?redirect=' + encodeURIComponent('cart.html');
    return;
  }
  window.location.href = 'checkout.html';
}
