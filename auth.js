// auth.js — session helpers, waits for sb to be ready

async function getSb() {
  if (window.sb) return window.sb;
  await initSupabase();
  return window.sb;
}

async function getUser() {
  const client = await getSb();
  const { data } = await client.auth.getUser();
  return data?.user || null;
}

async function getProfile(userId) {
  const client = await getSb();
  const { data } = await client.from('profiles').select('*').eq('id', userId).single();
  return data;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 2800);
}

async function renderAuthArea() {
  const el = document.getElementById('authArea');
  if (!el) return;
  const user = await getUser();
  if (user) {
    el.innerHTML = `
      <a href="/dashboard" style="color:var(--blue);font-weight:700">Dashboard</a>
      <button class="btn-outline" onclick="signOut()" style="padding:6px 16px">Sign Out</button>`;
  } else {
    el.innerHTML = `
      <a href="/login" style="color:var(--gray-700);font-weight:600">Login</a>
      <a href="/signup" class="btn-primary" style="padding:8px 18px">Sign Up</a>`;
  }
}

async function signOut() {
  const client = await getSb();
  await client.auth.signOut();
  localStorage.removeItem('sv_cart');
  window.location.href = '/';
}

async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  return user;
}
