// signup.js

let pendingEmail = '';
let pendingData = {};

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

function isOver18(dob) {
  const d = new Date(dob);
  const now = new Date();
  const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  return age >= 18;
}

async function startSignup() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const dob = document.getElementById('dob').value;
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  document.getElementById('errMsg').classList.remove('show');

  if (!firstName || !lastName || !email || !phone || !dob || !password)
    return showErr('errMsg', 'All fields are required.');
  if (!isOver18(dob))
    return showErr('errMsg', 'You must be at least 18 years old to register.');
  if (password.length < 8)
    return showErr('errMsg', 'Password must be at least 8 characters.');
  if (password !== confirm)
    return showErr('errMsg', 'Passwords do not match.');

  pendingData = { full_name: firstName + ' ' + lastName, phone, dob, email };
  pendingEmail = email;

  // Sign up via Supabase auth — will send OTP (magic link / OTP email)
  const { error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: window.location.origin + '//' }
  });

  if (error) return showErr('errMsg', error.message);

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

  const { data, error } = await sb.auth.verifyOtp({
    email: pendingEmail, token: otp, type: 'signup'
  });

  if (error) return showErr('errMsg2', error.message);

  // Save profile
  const user = data.user;
  if (user) {
    await sb.from('profiles').upsert({
      id: user.id,
      email: pendingData.email,
      full_name: pendingData.full_name,
      phone: pendingData.phone,
      dob: pendingData.dob
    });
  }

  window.location.href = '/';
}

async function resendOtp() {
  await sb.auth.resend({ type: 'signup', email: pendingEmail });
  alert('OTP resent! Please check your email.');
}
