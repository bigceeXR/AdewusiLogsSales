import React from 'react';
import { ShoppingCart, Globe, Users } from 'lucide-react';

export default function Marketplace({ listings, addToCart, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Fetching active digital inventories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Premium Social Inventory</h1>
        <p className="text-slate-500 mt-1">Verified platforms optimized for performance deployments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {listings.map((item) => (
          <div key={item.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-5">
                <span className="px-4 py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider">
                  {item.platform}
                </span>
                <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {item.country}
                </span>
              </div>

              <div className="space-y-1 mb-6">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900">{item.followers_count.toLocaleString()}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Followers</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <Users className="w-3.5 h-3.5 text-blue-500" /> {item.stock} configurations ready
                </div>
              </div>

              <div className="py-3 px-4 bg-blue-50/50 border border-blue-50 rounded-2xl flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-slate-500 uppercase">Unit Price</span>
                <span className="text-xl font-black text-blue-600">₦{Number(item.price).toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => addToCart(item)}
              disabled={item.stock === 0}
              className={`w-full py-4 rounded-2xl font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                item.stock > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {item.stock > 0 ? 'Add to Basket' : 'Out of Stock'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
