import { APP } from '../config.js';

const KEY = APP.cartStorageKey;
export const MAX_QTY = 50;

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => Number.isInteger(i?.product_id) && Number.isInteger(i?.qty) && i.qty > 0)
      .map((i) => ({ product_id: i.product_id, qty: Math.min(i.qty, MAX_QTY) }));
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode / full): cart just won't persist */
  }
  window.dispatchEvent(new CustomEvent('quickbite:cart-changed'));
}

export const getCart = read;

export const cartCount = () => read().reduce((sum, i) => sum + i.qty, 0);

export function addToCart(productId, qty = 1) {
  const items = read();
  const existing = items.find((i) => i.product_id === productId);
  if (existing) existing.qty = Math.min(existing.qty + qty, MAX_QTY);
  else items.push({ product_id: productId, qty: Math.min(qty, MAX_QTY) });
  write(items);
}

// qty <= 0 removes the item
export function setQuantity(productId, qty) {
  const items = read()
    .map((i) => (i.product_id === productId ? { ...i, qty: Math.min(qty, MAX_QTY) } : i))
    .filter((i) => i.qty > 0);
  write(items);
}

export function removeFromCart(productId) {
  write(read().filter((i) => i.product_id !== productId));
}

export function clearCart() {
  write([]);
}