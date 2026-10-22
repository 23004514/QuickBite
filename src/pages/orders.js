import '../styles/catalogue.css';
import '../styles/shop.css';
import '../styles/orders.css';
import { requireAuth } from '../services/auth.js';
import {
  fetchMyOrders, cancelOrder, redirectToPayment, verifyPayment, watchOrders,
  STATUS_LABELS, PAYMENT_LABELS, METHOD_LABELS, TIMELINE,
} from '../services/orders.js';
import { renderError } from '../components/states.js';
import { formatZAR, formatDateTime } from '../utils/format.js';
import { showMessage } from '../utils/forms.js';
import { escapeHtml, debounce, $ } from '../utils/dom.js';

const root = $('#orders-root');
const banner = $('#orders-msg');
const openIds = new Set();
let loading = false;

function timelineHtml(order) {
  if (order.status === 'cancelled') {
    return '<p class="form-msg form-msg--error">This order was cancelled.</p>';
  }
  const steps = TIMELINE[order.fulfilment];
  const current = steps.indexOf(order.status);
  return `<ol class="timeline" aria-label="Order progress">${steps
    .map((s, i) => {
      const cls = i < current ? ' is-done' : i === current ? ' is-current' : '';
      return `<li class="timeline__step${cls}"${i === current ? ' aria-current="step"' : ''}>${escapeHtml(STATUS_LABELS[s])}</li>`;
    })
    .join('')}</ol>`;
}

function orderHtml(o) {
  const canCancel = o.status === 'pending' && ['unpaid', 'failed'].includes(o.payment_status);
  const canPay =
    o.payment_method === 'card_online' &&
    ['unpaid', 'failed'].includes(o.payment_status) &&
    !['cancelled', 'delivered'].includes(o.status);

  const address =
    o.fulfilment === 'delivery'
      ? `<p><strong>Delivering to:</strong> ${escapeHtml(
          [o.delivery_street, o.delivery_suburb, o.delivery_city].filter(Boolean).join(', ')
        )}</p>`
      : '<p><strong>Collection</strong> from the restaurant</p>';

  return `
    <article class="order" data-order-id="${escapeHtml(o.id)}">
      <div class="order__head">
        <div>
          <h2 class="order__title">Order #${Number(o.order_number)}</h2>
          <p class="order__meta">${escapeHtml(formatDateTime(o.created_at))} · ${
            o.fulfilment === 'delivery' ? 'Delivery' : 'Collection'
          } · ${escapeHtml(METHOD_LABELS[o.payment_method] ?? o.payment_method)}</p>
          <div class="order__pills">
            <span class="pill pill--${escapeHtml(o.status)}">${escapeHtml(STATUS_LABELS[o.status] ?? o.status)}</span>
            <span class="pill pill--${escapeHtml(o.payment_status)}">${escapeHtml(PAYMENT_LABELS[o.payment_status] ?? o.payment_status)}</span>
          </div>
        </div>
        <div class="order__total">${formatZAR(o.total)}</div>
      </div>

      ${timelineHtml(o)}

      <details data-id="${escapeHtml(o.id)}"${openIds.has(o.id) ? ' open' : ''}>
        <summary>Order details</summary>
        <ul class="order__items">
          ${o.order_items
            .map(
              (i) =>
                `<li class="summary-row"><span>${Number(i.quantity)} × ${escapeHtml(i.product_name)}</span><span>${formatZAR(i.line_total)}</span></li>`
            )
            .join('')}
        </ul>
        <div class="summary-row"><span>Subtotal</span><span>${formatZAR(o.subtotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>${o.delivery_fee > 0 ? formatZAR(o.delivery_fee) : o.fulfilment === 'delivery' ? 'Free' : '—'}</span></div>
        ${
          o.discount_total > 0
            ? `<div class="summary-row summary-row--discount"><span>Discount${o.promo_code ? ' (' + escapeHtml(o.promo_code) + ')' : ''}</span><span>−${formatZAR(o.discount_total)}</span></div>`
            : ''
        }
        <div class="summary-row summary-row--total"><span>Total</span><span>${formatZAR(o.total)}</span></div>
        ${address}
        ${o.notes ? `<p><strong>Your notes:</strong> ${escapeHtml(o.notes)}</p>` : ''}
      </details>

      ${
        canPay || canCancel
          ? `<div class="order__actions">
              ${canPay ? `<button type="button" class="btn btn--accent btn--sm" data-action="pay" data-id="${escapeHtml(o.id)}">Pay now</button>` : ''}
              ${canCancel ? `<button type="button" class="btn btn--outline btn--sm" data-action="cancel" data-id="${escapeHtml(o.id)}">Cancel order</button>` : ''}
            </div>`
          : ''
      }
    </article>`;
}

function render(orders) {
  if (!orders.length) {
    root.innerHTML = `
      <div class="state">
        <p>You haven't placed any orders yet.</p>
        <a class="btn" href="/menu.html">Browse the menu</a>
      </div>`;
    return;
  }
  root.innerHTML = orders.map(orderHtml).join('');
}

async function load({ silent = false } = {}) {
  if (loading) return;
  loading = true;
  if (!silent) root.innerHTML = '<p class="muted">Loading your orders…</p>';
  try {
    render(await fetchMyOrders());
  } catch (err) {
    console.error(err);
    if (!silent) renderError(root, 'We could not load your orders.', () => load());
  } finally {
    loading = false;
  }
}

// Remember which order details are expanded across refreshes
root.addEventListener(
  'toggle',
  (event) => {
    const el = event.target;
    if (!(el instanceof HTMLDetailsElement)) return;
    if (el.open) openIds.add(el.dataset.id);
    else openIds.delete(el.dataset.id);
  },
  true
);

root.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  btn.disabled = true;
  showMessage(banner, '');

  try {
    if (btn.dataset.action === 'cancel') {
      if (!confirm('Cancel this order?')) {
        btn.disabled = false;
        return;
      }
      await cancelOrder(id);
      showMessage(banner, 'Your order has been cancelled.', 'success');
      await load({ silent: true });
    } else if (btn.dataset.action === 'pay') {
      btn.textContent = 'Opening payment…';
      await redirectToPayment(id); // leaves the page on success
    }
  } catch (err) {
    showMessage(banner, err.message);
    btn.disabled = false;
    if (btn.dataset.action === 'pay') btn.textContent = 'Pay now';
  }
});

// Customer returns from Paystack with ?reference=...: confirm it server-side.
async function handleReturnFromPayment() {
  const params = new URLSearchParams(location.search);
  const reference = params.get('reference') || params.get('trxref');
  if (!reference) return;
  history.replaceState(null, '', location.pathname);
  if (!/^[A-Za-z0-9._=-]{5,100}$/.test(reference)) return;

  showMessage(banner, 'Confirming your payment…', 'info');
  try {
    const { result } = await verifyPayment(reference);
    switch (result) {
      case 'paid':
      case 'already_paid':
        showMessage(banner, 'Payment received. Thank you!', 'success');
        break;
      case 'failed':
        showMessage(banner, 'The payment was not successful. You can try again with Pay now.');
        break;
      case 'pending':
        showMessage(banner, 'Your payment is still being processed. This page will update automatically.', 'info');
        break;
      default:
        showMessage(banner, 'We received your payment but need to check it. Please contact us with your order number.');
    }
  } catch (err) {
    console.error(err);
    showMessage(
      banner,
      'We could not confirm your payment yet. If you were charged, it will appear here shortly.',
      'info'
    );
  }
}

async function init() {
  const session = await requireAuth();
  if (!session) return;

  await handleReturnFromPayment();
  await load();

  // Live updates, with polling as a safety net
  watchOrders(session.user.id, debounce(() => load({ silent: true }), 500));
  setInterval(() => {
    if (document.visibilityState === 'visible') load({ silent: true });
  }, 30000);
}

init();