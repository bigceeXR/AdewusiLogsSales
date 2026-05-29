import React from 'react';
import { usePaystackPayment } from 'react-paystack';
import { supabase } from '../supabaseClient';
import { ShieldCheck } from 'lucide-react';

export default function CheckoutButton({ user, cart, total, onTriggerTerms, onPaymentSuccess }) {
  const config = {
    reference: `TXN_${Math.floor(Math.random() * 1000000000)}`,
    email: user?.email,
    amount: total * 100, // Paystack registers transactional values natively in Kobo
    publicKey: 'pk_test_your_paystack_public_key_string_goes_here', 
    currency: 'NGN'
  };

  const initializePayment = usePaystackPayment(config);

  const processOrderFulfillment = async (reference) => {
    try {
      // 1. Log payment event securely into master purchase schema
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert([{
          user_id: user.id,
          total_amount: total,
          is_completed: true,
          paystack_reference: reference.reference
        }])
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // 2. Provision inventory components dynamically
      for (const item of cart) {
        const { data: selection } = await supabase
          .from('accounts_inventory')
          .select('id')
          .eq('listing_id', item.id)
          .eq('is_sold', false)
          .limit(item.quantity);

        if (selection && selection.length > 0) {
          const targetedIds = selection.map(acc => acc.id);
          await supabase
            .from('accounts_inventory')
            .update({
              is_sold: true,
              purchase_id: purchase.id
            })
            .in('id', targetedIds);
        }
      }

      onPaymentSuccess();
    } catch (err) {
      alert(`System fault detected during allocation protocol: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          By proceeding with payment, you acknowledge absolute conformity to our system protocols. You explicitly agree to our{' '}
          <button 
            type="button"
            onClick={onTriggerTerms}
            className="text-blue-600 font-bold underline hover:text-blue-700 transition"
          >
            terms and conditions
          </button>{' '}
          guaranteeing immediate use and liability release configuration patterns.
        </p>
      </div>

      <button
        onClick={() => initializePayment(processOrderFulfillment)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]"
      >
        Complete Secure Payment
      </button>
    </div>
  );
}
