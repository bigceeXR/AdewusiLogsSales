// login.js

let loginEmail = '';

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  document.getElementById('errMsg').classList.remove('show');

  if (!email || !password) return showErr('errMsg', 'Please enter your email and password.');

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return showErr('errMsg', error.message);

  // Send OTP for 2-step verification
  loginEmail = email;
  await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });

  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  document.getElementById('otpEmail').textContent = email;
  initOtpInputs();
}

function initOtpInputs() {
  const inputs = document.querySelectorAll('#otpInputs input');
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
    });
  });
  inputs[0].focus();
}

function getOtpValue() {
  return [...document.querySelectorAll('#otpInputs input')].map(i => i.value).join('');
}

async function verifyOtp() {
  const otp = getOtpValue();
  document.getElementById('errMsg2').classList.remove('show');
  if (otp.length < 6) return showErr('errMsg2', 'Enter the full 6-digit OTP.');

  const { error } = await sb.auth.verifyOtp({
    email: loginEmail, token: otp, type: 'email'
  });

  if (error) return showErr('errMsg2', error.message);

  // Redirect to previous page or index
  const params = new URLSearchParams(window.location.search);
  window.location.href = params.get('redirect') || 'index.html';
}

async function resendOtp() {
  await sb.auth.signInWithOtp({ email: loginEmail, options: { shouldCreateUser: false } });
  alert('OTP resent! Check your email.');
}
