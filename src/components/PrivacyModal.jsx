import React from 'react';

export default function PrivacyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white w-full max-w-xl p-8 rounded-[2rem] shadow-2xl border border-blue-50 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">
          🛡️
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Legal Usage Agreement</h2>
        <div className="text-slate-600 text-sm leading-relaxed space-y-3 text-left bg-slate-50 p-5 rounded-2xl max-h-60 overflow-y-auto mb-6">
          <p className="font-bold text-slate-800">Please review our terms of procurement carefully:</p>
          <p>1. This marketplace provides digital assets strictly for verified technical environments, architectural testing, and authentic cross-border creative marketing application streams.</p>
          <p>2. Any illegal execution, platform policy circumvention, malicious activities, or cyber fraudulent deployments of assets obtained here is explicitly punishable by global law frameworks.</p>
          <p>3. We maintain absolute zero post-transaction liability. All systemic monitoring and profile compliance move completely to the client profile upon checkout completion.</p>
          <p>4. We trade exclusively for explicitly legitimate, structured, and lawful commercial activities.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 shadow-lg shadow-blue-600/10 active:scale-[0.98]"
        >
          Accept Terms & Continue
        </button>
      </div>
    </div>
  );
}
