import '../styles/catalogue.css';
import '../styles/shop.css';
import { getCart, setQuantity, removeFromCart, clearCart } from '../services/cart.js';
import { fetchCartProducts } from '../services/checkout.js';
import { renderError } from '../components/states.js';
import { formatZAR } from '../utils/format.js';
import { toCents, fromCents } from '../utils/money.js';
import { escapeHtml, $ } from '../utils/dom.js';

const root = $('#cart-root');
let products = new Map();

const money = (cents) => formatZAR(fromCents(cents));

function buildLines() {
  return getCart().map((item) => {
    const p = products.get(item.product_id);
    const ok = !!p && p.is_available;
    return {
      ...item,
      name: p?.name ?? 'Item no longer available',
      price: p?.price ?? 0,
      ok,
      lineCents: ok ? toCents(p.price) * item.qty : 0,
    };
  });
}

function lineHtml(l) {
  return `
    <li class="cart-item${l.ok ? '' : ' cart-item--off'}">
      <div>
        <div class="cart-item__name">${escapeHtml(l.name)}</div>
        <div class="cart-item__unit">${
          l.ok ? `${formatZAR(l.price)} each` : 'Unavailable. Please remove it to continue.'
        }</div>
      </div>
      <div class="qty" role="group" aria-label="Quantity for ${escapeHtml(l.name)}">
        <button type="button" class="qty__btn" data-action="dec" data-id="${l.product_id}" aria-label="Decrease quantity">−</button>
        <output class="qty__value">${l.qty}</output>
        <button type="button" class="qty__btn" data-action="inc" data-id="${l.product_id}" aria-label="Increase quantity">+</button>
      </div>
      <strong>${l.ok ? money(l.lineCents) : '—'}</strong>
      <button type="button" class="link-btn" data-action="remove" data-id="${l.product_id}">Remove</button>
    </li>`;
}

function render() {
  const lines = buildLines();
  if (!lines.length) {
    root.innerHTML = `
      <div class="state">
        <p>Your cart is empty.</p>
        <a class="btn" href="/menu.html">Browse the menu</a>
      </div>`;
    return;
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineCents, 0);
  const blocked = lines.some((l) => !l.ok);

  root.innerHTML = `
    <div class="layout-2">
      <section class="panel" aria-label="Cart items">
        <ul class="cart-list">${lines.map(lineHtml).join('')}</ul>
        <p><button type="button" class="link-btn" data-action="clear">Clear cart</button></p>
      </section>
      <aside class="panel" aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">Summary</h2>
        <div class="summary-row summary-row--total"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <p class="muted">Delivery fees and promo codes are applied at checkout.</p>
        ${
          blocked
            ? `<p class="form-msg form-msg--error">Remove unavailable items to continue.</p>
               <button type="button" class="btn btn--block" disabled>Checkout</button>`
            : `<a class="btn btn--accent btn--block" href="/checkout.html">Checkout</a>`
        }
        <p><a href="/menu.html">Continue shopping</a></p>
      </aside>
    </div>`;
}

root.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const current = getCart().find((i) => i.product_id === id)?.qty ?? 0;

  switch (btn.dataset.action) {
    case 'inc':
      setQuantity(id, current + 1);
      break;
    case 'dec':
      setQuantity(id, Math.max(current - 1, 1));
      break;
    case 'remove':
      removeFromCart(id);
      break;
    case 'clear':
      if (confirm('Remove everything from your cart?')) clearCart();
      break;
  }
  render();
});

async function load() {
  const cart = getCart();
  if (!cart.length) return render();
  root.innerHTML = '<p class="muted">Loading your cart…</p>';
  try {
    products = await fetchCartProducts(cart.map((i) => i.product_id));
    render();
  } catch (err) {
    console.error(err);
    renderError(root, 'We could not load your cart. Please try again.', load);
  }
}

load();