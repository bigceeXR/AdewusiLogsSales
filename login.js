async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  document.getElementById('errMsg').classList.remove('show');

  if (!email || !password) return showErr('errMsg', 'Please enter your email and password.');

  const btn = document.querySelector('#step1 .btn-primary');
  const reset = btnLoad(btn, 'Signing in...');

  try {
    await initSupabase();
    const { error } = await window.sb.auth.signInWithPassword({ email, password });

    if (error) {
      reset();
      return showErr('errMsg', error.message);
    }

    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('redirect') || '/';

  } catch (err) {
    reset();
    showErr('errMsg', 'Something went wrong. Please try again.');
  }
}

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}