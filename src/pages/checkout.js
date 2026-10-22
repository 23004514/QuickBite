import '../styles/shop.css';
import { requireAuth } from '../services/auth.js';
import { getCart, clearCart } from '../services/cart.js';
import { fetchCartProducts, fetchSettings, previewPromo, placeOrder } from '../services/checkout.js';
import { fetchProfile, fetchAddresses } from '../services/account.js';
import { renderError } from '../components/states.js';
import { formatZAR } from '../utils/format.js';
import { toCents, fromCents } from '../utils/money.js';
import { PHONE_RE, setBusy, showMessage } from '../utils/forms.js';
import { escapeHtml, $ } from '../utils/dom.js';
import { redirectToPayment } from '../services/orders.js';

const status = $('#checkout-status');
const layout = $('#checkout-layout');
const form = $('#checkout-form');
const msg = $('#form-msg');
const promoInput = $('#promo');
const promoMsg = $('#promo-msg');
const submitBtn = $('#place-order');
const savedSelect = $('#saved-address');

const KEY_STORE = 'quickbite.checkout-key';
const state = { lines: [], settings: null, addresses: [], promo: null, fulfilment: 'delivery' };
let submitting = false;

const money = (cents) => formatZAR(fromCents(cents));

// One key per checkout attempt: a retry after a network failure returns the original order.
function getIdempotencyKey() {
  try {
    let key = sessionStorage.getItem(KEY_STORE);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(KEY_STORE, key);
    }
    return key;
  } catch {
    return crypto.randomUUID();
  }
}
function resetIdempotencyKey() {
  try {
    sessionStorage.removeItem(KEY_STORE);
  } catch {
    /* ignore */
  }
}

function fail(message) {
  showMessage(msg, message);
  msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Estimate for display only. create_order() computes the real figures.
function totals() {
  const subtotal = state.lines.reduce((sum, l) => sum + l.lineCents, 0);
  let fee = 0;
  if (state.fulfilment === 'delivery') {
    fee = toCents(state.settings.delivery_fee);
    const threshold = state.settings.free_delivery_threshold;
    if (threshold != null && subtotal >= toCents(threshold)) fee = 0;
  }
  const discount = state.promo ? Math.min(state.promo.discount, subtotal) : 0;
  return { subtotal, fee, discount, total: subtotal + fee - discount };
}

function renderSummary() {
  $('#summary-items').innerHTML = state.lines
    .map(
      (l) => `<li class="summary-row"><span>${l.qty} × ${escapeHtml(l.name)}</span><span>${money(l.lineCents)}</span></li>`
    )
    .join('');

  const t = totals();
  const deliveryLabel =
    state.fulfilment === 'delivery' ? (t.fee ? money(t.fee) : 'Free') : 'Collection';

  $('#summary-totals').innerHTML = `
    <div class="summary-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
    <div class="summary-row"><span>Delivery</span><span>${deliveryLabel}</span></div>
    ${
      t.discount
        ? `<div class="summary-row summary-row--discount"><span>Discount (${escapeHtml(state.promo.code)})</span><span>−${money(t.discount)}</span></div>`
        : ''
    }
    <div class="summary-row summary-row--total"><span>Estimated total</span><span>${money(t.total)}</span></div>`;
}

function renderPayments() {
  const testMode = state.settings.payments_test_mode;
  const online = state.settings.online_payments_enabled;
  const cashLabel = state.fulfilment === 'delivery' ? 'Pay cash on delivery' : 'Pay when you collect';

  const picked = form.querySelector('input[name="payment"]:checked')?.value;
  const selected =
    (picked === 'test' && testMode) || (picked === 'card_online' && online) ? picked : 'cash';

  $('#payment-options').innerHTML = `
    <label class="choice">
      <input type="radio" name="payment" value="cash" ${selected === 'cash' ? 'checked' : ''} />
      <span>${cashLabel}</span>
    </label>
    <label class="choice${online ? '' : ' choice--disabled'}">
      <input type="radio" name="payment" value="card_online" ${online ? '' : 'disabled'} ${selected === 'card_online' ? 'checked' : ''} />
      <span>Pay online by card<small>${online ? 'You will be taken to Paystack to pay securely' : 'Coming soon'}</small></span>
    </label>
    ${
      testMode
        ? `<label class="choice">
             <input type="radio" name="payment" value="test" ${selected === 'test' ? 'checked' : ''} />
             <span>Test payment<small>Development mode: no real money is taken</small></span>
           </label>`
        : ''
    }`;
}

function fillAddress(a) {
  $('#street').value = a?.street ?? '';
  $('#suburb').value = a?.suburb ?? '';
  $('#city').value = a?.city ?? '';
  $('#postal_code').value = a?.postal_code ?? '';
  $('#instructions').value = a?.instructions ?? '';
}

function setupAddresses() {
  if (!state.addresses.length) return;
  savedSelect.innerHTML =
    '<option value="">Enter a new address</option>' +
    state.addresses
      .map((a, i) => `<option value="${i}">${escapeHtml(a.label || a.street)}, ${escapeHtml(a.city)}</option>`)
      .join('');
  $('#saved-address-field').hidden = false;
  savedSelect.value = '0';
  fillAddress(state.addresses[0]);
}

function showConfirmation(order, note = '') {
  layout.hidden = true;
  const payment =
    order.payment_method === 'test'
      ? 'Test payment (no real money taken)'
      : order.payment_method === 'card_online'
        ? 'Online card payment'
        : order.fulfilment === 'delivery'
          ? 'Pay cash on delivery'
          : 'Pay when you collect';

  status.innerHTML = `
    <div class="panel confirm">
      <div class="confirm__icon" aria-hidden="true">✅</div>
      <h2>Order placed!</h2>
      <p>Your order number is <strong>#${Number(order.order_number)}</strong>.</p>
      <p>Total: <strong>${formatZAR(order.total)}</strong> · ${escapeHtml(payment)}</p>
      ${note ? `<p class="form-msg form-msg--info">${escapeHtml(note)}</p>` : ''}
      <p class="muted">Follow its progress under My Orders.</p>
      <a class="btn" href="/orders.html">View my orders</a>
      <a class="btn btn--outline" href="/menu.html">Order something else</a>
    </div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function goToPayment(order) {
  status.innerHTML = '<p class="muted">Order placed. Taking you to the secure payment page…</p>';
  layout.hidden = true;
  try {
    await redirectToPayment(order.id); // leaves the page on success
  } catch (err) {
    console.error(err);
    showConfirmation(
      order,
      'Your order was created, but we could not open the payment page. You can pay from My Orders.'
    );
  }
}

async function init() {
  const session = await requireAuth();
  if (!session) return;

  const cart = getCart();
  if (!cart.length) {
    status.innerHTML = `
      <div class="state">
        <p>Your cart is empty.</p>
        <a class="btn" href="/menu.html">Browse the menu</a>
      </div>`;
    return;
  }

  status.innerHTML = '<p class="muted">Loading your checkout…</p>';
  try {
    const [productMap, settings, profile, addresses] = await Promise.all([
      fetchCartProducts(cart.map((i) => i.product_id)),
      fetchSettings(),
      fetchProfile(session.user.id),
      fetchAddresses(),
    ]);

    state.settings = settings;
    state.addresses = addresses;
    state.lines = cart.map((item) => {
      const p = productMap.get(item.product_id);
      const ok = !!p && p.is_available;
      return {
        ...item,
        name: p?.name ?? 'Unavailable item',
        ok,
        lineCents: ok ? toCents(p.price) * item.qty : 0,
      };
    });

    if (state.lines.some((l) => !l.ok)) {
      status.innerHTML = `
        <div class="panel">
          <p>Some items in your cart are no longer available.</p>
          <a class="btn" href="/cart.html">Review your cart</a>
        </div>`;
      return;
    }

    $('#name').value = profile.full_name ?? '';
    $('#phone').value = profile.phone ?? '';
    setupAddresses();
    renderPayments();
    renderSummary();
    status.innerHTML = '';
    layout.hidden = false;
  } catch (err) {
    console.error(err);
    renderError(status, 'We could not load checkout. Please try again.', init);
  }
}

form.addEventListener('change', (event) => {
  if (event.target.name === 'fulfilment') {
    state.fulfilment = event.target.value;
    $('#address-panel').hidden = state.fulfilment !== 'delivery';
    renderPayments();
    renderSummary();
  }
});

savedSelect.addEventListener('change', () => {
  fillAddress(savedSelect.value === '' ? null : state.addresses[Number(savedSelect.value)]);
});

promoInput.addEventListener('input', () => {
  if (state.promo) {
    state.promo = null;
    renderSummary();
  }
  showMessage(promoMsg, '');
});

$('#promo-apply').addEventListener('click', async (event) => {
  const code = promoInput.value.trim();
  if (!code) return;
  const button = event.currentTarget;
  setBusy(button, true, 'Checking…');
  const result = await previewPromo(code, totals().subtotal / 100);
  setBusy(button, false);

  if (result.valid) {
    state.promo = { code: code.toUpperCase(), discount: toCents(result.discount) };
    showMessage(promoMsg, result.message, 'success');
  } else {
    state.promo = null;
    showMessage(promoMsg, result.message);
  }
  renderSummary();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;
  showMessage(msg, '');

  const data = new FormData(form);
  const v = (key) => String(data.get(key) ?? '').trim();
  const fulfilment = v('fulfilment');
  const name = v('name');
  const phone = v('phone');

  if (name.length < 2) return fail('Please enter your full name.');
  if (!PHONE_RE.test(phone)) return fail('Please enter a valid phone number.');
  if (fulfilment === 'delivery' && (!v('street') || !v('city'))) {
    return fail('Please enter your street address and city.');
  }
  const minimum = toCents(state.settings.min_order_amount);
  if (totals().subtotal < minimum) return fail(`The minimum order is ${money(minimum)}.`);

  submitting = true;
  setBusy(submitBtn, true, 'Placing order…');
  try {
    const order = await placeOrder({
      items: state.lines.map((l) => ({ product_id: l.product_id, quantity: l.qty })),
      fulfilment,
      paymentMethod: v('payment') || 'cash',
      name,
      phone,
      street: v('street'),
      suburb: v('suburb'),
      city: v('city'),
      postalCode: v('postal_code'),
      instructions: v('instructions'),
      promoCode: promoInput.value.trim(),
      notes: v('notes'),
      idempotencyKey: getIdempotencyKey(),
    });
    clearCart();
    resetIdempotencyKey();
    if (order.payment_method === 'card_online') {
      await goToPayment(order);
    } else {
      showConfirmation(order);
    }
  } catch (err) {
    fail(err.message); // form data and cart stay intact
  } finally {
    submitting = false;
    setBusy(submitBtn, false);
  }
});

init();