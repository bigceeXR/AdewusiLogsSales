// loader.js — Windows 11 style loading utilities

// ── SVG spinner markup ──────────────────────────────────────────────
function spinnerSVG(color = '#ffffff', size = 20) {
  return `<span class="w11-spinner" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" stroke="${color}"/>
    </svg>
  </span>`;
}

// ── Button loader ───────────────────────────────────────────────────
// Usage: const reset = btnLoad(btn, 'Signing in...')  →  reset() to restore
function btnLoad(btn, text = 'Loading...') {
  const original = btn.innerHTML;
  const isOutline = btn.classList.contains('btn-outline');
  const spinColor = isOutline ? '#1a6bff' : '#ffffff';
  btn.classList.add('btn-loading');
  btn.innerHTML = `${spinnerSVG(spinColor, 18)}<span class="btn-text">${text}</span>`;
  return function reset(newLabel) {
    btn.classList.remove('btn-loading');
    btn.innerHTML = newLabel || original;
  };
}

// ── Page overlay loader ─────────────────────────────────────────────
// Usage: const hide = pageLoad('Verifying OTP...')  →  hide() to dismiss
let _pageLoader = null;
function pageLoad(msg = 'Loading...') {
  if (!_pageLoader) {
    _pageLoader = document.createElement('div');
    _pageLoader.className = 'page-loader';
    _pageLoader.innerHTML = `
      <span class="w11-spinner">
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r="22" stroke="#1a6bff" stroke-width="4"/>
        </svg>
      </span>
      <p id="_pageLoaderMsg">Loading...</p>`;
    document.body.appendChild(_pageLoader);
  }
  document.getElementById('_pageLoaderMsg').textContent = msg;
  requestAnimationFrame(() => _pageLoader.classList.add('show'));
  return function hide() {
    _pageLoader.classList.remove('show');
  };
}

// ── Skeleton grid (replaces a container with shimmer cards) ─────────
// Usage: skelGrid(el, 6)  →  shows 6 skeleton cards
function skelGrid(el, count = 3) {
  el.innerHTML = Array(count).fill(`
    <div class="account-card" style="padding:20px">
      <div class="sk-row full" style="height:22px;margin-bottom:16px"></div>
      <div class="sk-row medium"></div>
      <div class="sk-row short"></div>
      <div class="sk-row full" style="margin-top:12px"></div>
      <div class="sk-row medium" style="margin-top:8px"></div>
    </div>`).join('');
}

// ── Skeleton table rows ─────────────────────────────────────────────
function skelTable(tbodyEl, cols = 5, rows = 4) {
  tbodyEl.innerHTML = Array(rows).fill(`
    <tr>${Array(cols).fill(`
      <td><div class="sk-row ${['full','medium','short'][Math.floor(Math.random()*3)]}"></div></td>
    `).join('')}</tr>`).join('');
}

// ── Link load state ─────────────────────────────────────────────────
// Usage: linkLoad(aEl)  →  returns reset fn
function linkLoad(el) {
  el.classList.add('link-loading');
  return () => el.classList.remove('link-loading');
}

// ── Auto-wire: data-load-text on buttons & anchors ──────────────────
// Add  data-load-text="Signing in..."  to any <button> or <a>
// and it will auto-show spinner on click.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-load-text]').forEach(el => {
    el.addEventListener('click', function() {
      if (el.tagName === 'A') {
        linkLoad(el);
      } else {
        btnLoad(el, el.dataset.loadText);
      }
    });
  });
});