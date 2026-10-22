import { supabase } from '../supabase.js';

export const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_collection: 'Ready for collection',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABELS = {
  unpaid: 'Unpaid',
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export const METHOD_LABELS = {
  cash: 'Cash',
  card_online: 'Card (online)',
  test: 'Test payment',
};

export const TIMELINE = {
  delivery: ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'],
  collection: ['pending', 'confirmed', 'preparing', 'ready_for_collection', 'delivered'],
};

const ORDER_FIELDS = `
  id, order_number, status, payment_status, payment_method, fulfilment,
  subtotal, delivery_fee, discount_total, total, promo_code, notes,
  delivery_street, delivery_suburb, delivery_city, created_at,
  order_items (id, product_name, unit_price, quantity, line_total)
`;

export async function fetchMyOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_FIELDS)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((o) => ({
    ...o,
    order_items: [...(o.order_items ?? [])].sort((a, b) => a.id - b.id),
  }));
}

export async function cancelOrder(orderId) {
  const { error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId });
  if (error) {
    console.error(error);
    if (error.code === 'P0001') throw new Error(error.message); // our own safe messages
    throw new Error('We could not cancel this order. Please try again.');
  }
}

async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = 'Something went wrong. Please try again.';
    try {
      const detail = await error.context?.json?.();
      if (detail?.error) message = detail.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  return data;
}

export const verifyPayment = (reference) => callFunction('paystack-verify', { reference });

// Starts a Paystack payment and sends the browser to Paystack's hosted page.
export async function redirectToPayment(orderId) {
  const { authorization_url } = await callFunction('paystack-initialize', { order_id: orderId });
  const url = new URL(authorization_url);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('paystack.com')) {
    throw new Error('Unexpected payment address.');
  }
  location.assign(url.href);
}

// Realtime updates for this customer's orders (RLS limits what they can receive).
export function watchOrders(userId, onChange) {
  const channel = supabase
    .channel(`orders-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
      () => onChange()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}