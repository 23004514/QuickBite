import { escapeHtml } from '../utils/dom.js';
import { showToast } from '../utils/dom.js';
import { formatZAR } from '../utils/format.js';
import { addToCart, MAX_QTY } from '../services/cart.js';

const EMOJI = {
  burgers: '🍔',
  'fast-food': '🍟',
  pizza: '🍕',
  chicken: '🍗',
  'wraps-tacos': '🌮',
  snacks: '🧆',
  desserts: '🍰',
  drinks: '🥤',
  milkshakes: '🥛',
};

export const categoryEmoji = (slug) => EMOJI[slug] ?? '🍽️';

// Only allow https images or same-origin paths.
function safeImageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url, location.origin);
    return u.protocol === 'https:' || u.origin === location.origin ? u.href : null;
  } catch {
    return null;
  }
}

export function renderProductCard(p) {
  const img = safeImageUrl(p.image_url);
  const category = p.categories ?? {};
  const name = escapeHtml(p.name);
  const off = !p.is_available;

  const media = img
    ? `<img src="${escapeHtml(img)}" alt="${name}" loading="lazy" width="400" height="300">`
    : `<div class="card__placeholder" aria-hidden="true">${categoryEmoji(category.slug)}</div>`;

  return `
    <article class="card${off ? ' card--off' : ''}" data-product-id="${Number(p.id)}">
      <div class="card__media">
        ${media}
        ${p.is_popular ? '<span class="badge">Popular</span>' : ''}
        ${off ? '<span class="badge badge--off">Sold out</span>' : ''}
      </div>
      <div class="card__body">
        <p class="card__category">${escapeHtml(category.name ?? '')}</p>
        <h3 class="card__title">${name}</h3>
        <p class="card__desc">${escapeHtml(p.description ?? '')}</p>
        <div class="card__footer">
          <span class="card__price">${formatZAR(p.price)}</span>
          <div class="qty" role="group" aria-label="Quantity for ${name}">
            <button type="button" class="qty__btn" data-action="dec" aria-label="Decrease quantity"${off ? ' disabled' : ''}>−</button>
            <output class="qty__value">1</output>
            <button type="button" class="qty__btn" data-action="inc" aria-label="Increase quantity"${off ? ' disabled' : ''}>+</button>
          </div>
          <button type="button" class="btn btn--accent btn--sm" data-action="add"${off ? ' disabled' : ''}>Add</button>
        </div>
      </div>
    </article>`;
}

// One delegated listener per grid handles every card's quantity and add buttons.
export function bindProductGrid(container) {
  container.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    const card = btn.closest('.card');
    if (!card) return;

    const output = card.querySelector('.qty__value');
    let qty = Number(output.textContent) || 1;

    switch (btn.dataset.action) {
      case 'inc':
        qty = Math.min(qty + 1, MAX_QTY);
        break;
      case 'dec':
        qty = Math.max(qty - 1, 1);
        break;
      case 'add': {
        addToCart(Number(card.dataset.productId), qty);
        const title = card.querySelector('.card__title').textContent;
        showToast(`Added ${qty} × ${title} to your cart`, 'success');
        qty = 1;
        break;
      }
    }
    output.textContent = String(qty);
  });
}