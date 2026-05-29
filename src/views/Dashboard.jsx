import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, Eye, EyeOff, ShieldAlert, Copy } from 'lucide-react';

export default function Dashboard({ user }) {
  const [vaultItems, setVaultItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealedIndex, setRevealedIndex] = useState({});

  useEffect(() => {
    fetchAcquiredVault();
  }, []);

  async function fetchAcquiredVault() {
    const { data, error } = await supabase
      .from('accounts_inventory')
      .select(`
        id, email_or_phone, password, two_factor_auth, two_factor_host,
        listings (platform, followers_count, country)
      `)
      .eq('is_sold', true);

    if (!error && data) setVaultItems(data);
    setLoading(false);
  }

  const toggleCredentialVisibility = (idx) => {
    setRevealedIndex(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Decrypting security vaults...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Asset Vault</h2>
        <p className="text-slate-500 mt-1">Instant delivery matrix showing real-time configuration arrays.</p>
      </div>

      {vaultItems.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-16 text-center max-w-xl mx-auto">
          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Assets Claimed</h3>
          <p className="text-slate-400 text-sm">Completed transaction modules render credential packets instantly within this layout framework.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vaultItems.map((account, index) => (
            <div key={account.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
              <div>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-wider mb-2 inline-block">
                  {account.listings?.platform}
                </span>
                <h4 className="text-xl font-black text-slate-900">
                  {account.listings?.followers_count.toLocaleString()} <span className="text-slate-400 font-medium text-sm">Followers Matrix</span>
                </h4>
                <p className="text-xs font-bold text-slate-400 mt-0.5">Origin Location: {account.listings?.country}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full xl:w-auto bg-slate-50 border border-slate-100/50 p-5 rounded-2xl text-xs">
                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[10px]">User Identifier</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                    <span className="select-all">{account.email_or_phone}</span>
                    <button onClick={() => copyToClipboard(account.email_or_phone)} className="text-slate-400 hover:text-blue-600"><Copy className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[10px]">Access Password</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                    <input type={revealedIndex[index] ? 'text' : 'password'} readOnly value={account.password} className="bg-transparent font-mono font-bold text-slate-800 w-24 outline-none select-all" />
                    <button onClick={() => toggleCredentialVisibility(index)} className="text-slate-400 hover:text-blue-600">
                      {revealedIndex[index] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[10px]">2FA Token Key</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-600">
                    <span className="select-all">{account.two_factor_auth || 'N/A'}</span>
                    {account.two_factor_auth && (
                      <button onClick={() => copyToClipboard(account.two_factor_auth)} className="text-slate-400 hover:text-blue-600"><Copy className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-400 block font-bold uppercase tracking-wider text-[10px]">2FA Host Domain</span>
                  <span className="font-bold text-slate-600 block truncate max-w-[120px]">{account.two_factor_host || 'Direct Platform'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
