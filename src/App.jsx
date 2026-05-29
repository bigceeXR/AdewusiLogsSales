import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Marketplace from './components/Marketplace';
import Dashboard from './views/Dashboard';
import PrivacyModal from './components/PrivacyModal';
import AuthModal from './components/AuthModal';
import CheckoutButton from './components/CheckoutButton';
import { LayoutGrid, Vault, ShoppingBag, Plus, Minus, Trash2, LogOut } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('marketplace'); // marketplace | dashboard
  const [listings, setListings] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accepted = localStorage.getItem('legal_accepted');
    if (!accepted) setIsPrivacyOpen(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    fetchSynchronizedListings();
  }, []);

  async function fetchSynchronizedListings() {
    const { data, error } = await supabase
      .from('listings')
      .select('id, platform, followers_count, country, price, accounts_inventory(id, is_sold)');

    if (!error && data) {
      const formatted = data.map(item => ({
        id: item.id,
        platform: item.platform,
        followers_count: item.followers_count,
        country: item.country,
        price: item.price,
        stock: item.accounts_inventory?.filter(acc => !acc.is_sold).length || 0
      }));
      setListings(formatted);
    }
    setLoading(false);
  }

  const addToCart = (product) => {
    setCart(prev => {
      const present = prev.find(i => i.id === product.id);
      if (present) {
        if (present.quantity < product.stock) {
          return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
        }
        return prev;
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, change) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const targetVal = item.quantity + change;
        if (targetVal > 0 && targetVal <= item.stock) {
          return { ...item, quantity: targetVal };
        }
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView('marketplace');
  };

  const totalCartCost = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans antialiased pb-12">
      {/* Structural Header Integration */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('marketplace')}>
            <div className="w-10 h-10 bg-blue-600 text-white font-black rounded-xl flex items-center justify-center text-xl shadow-md shadow-blue-600/10">Ω</div>
            <span className="text-xl font-black text-slate-900 tracking-tight">Social<span className="text-blue-600">Vault</span></span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('marketplace')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${view === 'marketplace' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Storefront
            </button>
            {user && (
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <Vault className="w-4 h-4" /> Asset Vault
              </button>
            )}
            {user ? (
              <button onClick={handleLogout} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"><LogOut className="w-5 h-5" /></button>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition">Connect Identity</button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className={view === 'marketplace' && cart.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'}>
          {view === 'marketplace' ? (
            <Marketplace listings={listings} addToCart={addToCart} loading={loading} />
          ) : (
            <Dashboard user={user} />
          )}
        </div>

        {/* Dynamic Context Cart Area */}
        {view === 'marketplace' && cart.length > 0 && (
          <div className="lg:col-span-4 bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm h-fit space-y-6 sticky top-24 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 border-b border-slate-50 pb-4">
              <ShoppingBag className="w-5 h-5 text-blue-600" />
              <h3 className="font-black text-slate-900 text-lg">Allocation Basket</h3>
            </div>

            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-black text-blue-600">{item.platform}</span>
                    <h5 className="font-bold text-sm text-slate-900">{item.followers_count.toLocaleString()} Followers</h5>
                    <p className="text-xs font-bold text-blue-600">₦{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                  
                  {/* Quantity Adjustment Toolsets */}
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl px-1.5 py-1 gap-2 shadow-sm">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-slate-50 text-slate-500 rounded-md"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-xs font-black text-slate-800 w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-slate-50 text-slate-500 rounded-md"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-50 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Gross Aggregate</span>
                <span className="text-2xl font-black text-slate-900">₦{totalCartCost.toLocaleString()}</span>
              </div>

              {user ? (
                <CheckoutButton 
                  user={user} 
                  cart={cart} 
                  total={totalCartCost} 
                  onTriggerTerms={() => setIsPrivacyOpen(true)}
                  onPaymentSuccess={() => {
                    setCart([]);
                    fetchSynchronizedListings();
                    setView('dashboard');
                  }}
                />
              ) : (
                <button 
                  onClick={() => setIsAuthOpen(true)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition"
                >
                  Verify Identity To Checkout
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => {
        localStorage.setItem('legal_accepted', 'true');
        setIsPrivacyOpen(false);
      }} />
      
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onAuthSuccess={(authenticatedUser) => setUser(authenticatedUser)} />
    </div>
  );
}
