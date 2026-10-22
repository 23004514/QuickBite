import { supabase } from '../supabase.js';

// Active products only (RLS). Anything missing from the result is treated as unavailable.
export async function fetchCartProducts(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, image_url, is_available')
    .in('id', ids);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p]));
}

export async function fetchSettings() {
  const { data, error } = await supabase
    .from('store_settings')
    .select('delivery_fee, free_delivery_threshold, min_order_amount, payments_test_mode, online_payments_enabled')
    .single();
  if (error) throw error;
  return data;
}

// Preview only. create_order() re-validates the code itself.
export async function previewPromo(code, subtotal) {
  const { data, error } = await supabase.rpc('validate_promo', {
    p_code: code,
    p_subtotal: subtotal,
  });
  if (error) {
    console.error(error);
    return { valid: false, discount: 0, message: 'We could not check that code. Please try again.' };
  }
  return data;
}

export async function placeOrder(input) {
  const { data, error } = await supabase.rpc('create_order', {
    p_items: input.items,
    p_fulfilment: input.fulfilment,
    p_payment_method: input.paymentMethod,
    p_customer_name: input.name,
    p_customer_phone: input.phone,
    p_delivery_street: input.street || null,
    p_delivery_suburb: input.suburb || null,
    p_delivery_city: input.city || null,
    p_delivery_postal_code: input.postalCode || null,
    p_delivery_instructions: input.instructions || null,
    p_promo_code: input.promoCode || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    console.error(error);
    // P0001 = our own deliberate messages (stock, promo, minimum order...). Safe to show.
    if (error.code === 'P0001') throw new Error(error.message);
    if (error.code === '28000') throw new Error('Please log in again to place your order.');
    throw new Error('We could not place your order. Please try again.');
  }
  return data;
}