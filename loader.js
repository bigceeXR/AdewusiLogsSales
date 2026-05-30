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

// ── Skeleton grid ───────────────────────────────────────────────────
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
function linkLoad(el) {
  el.classList.add('link-loading');
  return () => el.classList.remove('link-loading');
}

// ── Auto-wire ───────────────────────────────────────────────────────
// Checks inputs before showing loader so it never loads on bad/empty input
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-load-text]').forEach(el => {
    el.addEventListener('click', function () {
      const parent = el.closest('form, div, section') || document.body;
      const requiredInputs = parent.querySelectorAll(
        'input[required], input[type="email"], input[type="password"], input[type="tel"], input[type="date"]'
      );

      // Check for empty inputs
      const hasEmpty = [...requiredInputs].some(inp => !inp.value.trim());

      // Check for inputs that are too short
      const hasTooShort = [...requiredInputs].some(inp => {
        const min = inp.dataset.minLength;
        return min && inp.value.trim().length < parseInt(min);
      });

      // Check passwords match (if confirm password field exists)
      const passEl = parent.querySelector('input[type="password"]');
      const confirmEl = parent.querySelector('#confirmPassword');
      const passwordMismatch = passEl && confirmEl && passEl.value !== confirmEl.value;

      // Only show loader if all checks pass
      if (hasEmpty || hasTooShort || passwordMismatch) return;

      if (el.tagName === 'A') {
        linkLoad(el);
      } else {
        btnLoad(el, el.dataset.loadText);
      }
    });
  });
});