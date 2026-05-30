// loader.js — Windows 11 style loading utilities

// ── Active button reset tracker ─────────────────────────────────────
// Stores the reset function of the currently loading button
// so any JS file can call resetActiveBtn() to stop the loader
let _activeBtnReset = null;

function resetActiveBtn() {
  if (_activeBtnReset) {
    _activeBtnReset();
    _activeBtnReset = null;
  }
}

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
  const reset = function(newLabel) {
    btn.classList.remove('btn-loading');
    btn.innerHTML = newLabel || original;
    if (_activeBtnReset === reset) _activeBtnReset = null;
  };
  _activeBtnReset = reset;
  return reset;
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

// ── Patch showErr to auto-stop loader on any error ──────────────────
// Wraps the global showErr functions used in login.js and signup.js
// so whenever an error is shown, the button loader stops automatically
const _origShowErr = window.showErr;
document.addEventListener('DOMContentLoaded', () => {
  // Override showErr globally after all scripts load
  // Each page defines its own showErr — we wrap it here
  const pages = [
    { fn: 'showErr', files: ['login.js', 'signup.js', 'forgot.html', 'reset.html'] }
  ];

  // Intercept any call that shows an error element and stop the loader
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          const el = node.classList?.contains('error-msg') ? node :
                     node.querySelector?.('.error-msg');
          if (el && el.classList.contains('show')) resetActiveBtn();
        }
      });
      // Also watch class changes on error-msg elements
      if (m.type === 'attributes' && m.target.classList?.contains('error-msg')) {
        if (m.target.classList.contains('show')) resetActiveBtn();
      }
    });
  });

  // Observe all error message elements on the page
  document.querySelectorAll('.error-msg').forEach(el => {
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
  });

  // Also observe body for dynamically added error elements
  observer.observe(document.body, { childList: true, subtree: true });
});

// ── Auto-wire: data-load-text on buttons & anchors ──────────────────
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