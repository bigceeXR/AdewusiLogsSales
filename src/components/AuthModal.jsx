import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { KeyRound, Mail, User, Calendar, Phone } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('register'); // register | verify
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const checkAgeValidity = (dateString) => {
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!checkAgeValidity(dob)) {
      setError('Regulatory Restriction: You must be at least 18 years old to trade on this platform.');
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: true }
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setStep('verify');
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email'
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      // Create profile record inside public db schema context
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          name,
          dob,
          phone_no: phone
        });

      setLoading(false);
      if (profileError) {
        setError(profileError.message);
      } else {
        onAuthSuccess(data.user);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border border-slate-50 animate-in fade-in duration-200">
        <h2 className="text-2xl font-black text-slate-900 mb-2 text-center">
          {step === 'register' ? 'Gateway Identity Setup' : 'Verification Vault'}
        </h2>
        <p className="text-slate-400 text-xs text-center mb-6">
          {step === 'register' ? 'Secure, passwordless verification protocol.' : `One-time code delivered to ${email}`}
        </p>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl mb-4">
            {error}
          </div>
        )}

        {step === 'register' ? (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input required type="text" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-800" value={name} onChange={e => setName(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input required type="email" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-800" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Date of Birth</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input required type="date" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-800" value={dob} onChange={e => setDob(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input required type="tel" className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500 font-medium text-slate-800" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-md shadow-blue-600/10 mt-2">
              {loading ? 'Generating Security Token...' : 'Transmit Access Token'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block text-center mb-2">Input 6-Digit OTP</label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-4 w-5 h-5 text-slate-400" />
                <input required type="text" placeholder="******" maxLength={6} className="w-full bg-slate-50 border border-slate-100 text-center tracking-[0.5em] text-xl font-black rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:border-blue-500 text-slate-800" value={otp} onChange={e => setOtp(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-md shadow-emerald-600/10">
              {loading ? 'Authenticating Credentials...' : 'Unlock Identity Profile'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
