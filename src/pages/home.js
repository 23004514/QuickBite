import '../styles/catalogue.css';
import {
  fetchCategories,
  fetchPopularProducts,
  fetchPublicPromotions,
} from '../services/products.js';
import { renderProductCard, bindProductGrid, categoryEmoji } from '../components/productCard.js';
import { skeletonCards, renderError, renderEmpty } from '../components/states.js';
import { escapeHtml, $ } from '../utils/dom.js';

async function loadPromos() {
  const strip = $('#promo-strip');
  try {
    const promos = await fetchPublicPromotions();
    if (!promos.length) return;
    const p = promos[0];
    strip.innerHTML = `🎉 ${escapeHtml(p.description ?? 'Special offer')}: use code <strong>${escapeHtml(p.code)}</strong> at checkout`;
    strip.hidden = false;
  } catch (err) {
    console.error('Promotions failed to load', err);
  }
}

async function loadCategories() {
  const el = $('#category-grid');
  try {
    const categories = await fetchCategories();
    el.innerHTML = categories
      .map(
        (c) => `
        <a class="cat-tile" href="/menu.html?category=${encodeURIComponent(c.slug)}">
          <span class="cat-tile__icon" aria-hidden="true">${categoryEmoji(c.slug)}</span>
          <span>${escapeHtml(c.name)}</span>
        </a>`
      )
      .join('');
  } catch (err) {
    console.error(err);
    renderError(el, 'We could not load the categories.', loadCategories);
  }
}

async function loadPopular() {
  const el = $('#popular-grid');
  el.innerHTML = skeletonCards(4);
  try {
    const products = await fetchPopularProducts(8);
    if (!products.length) return renderEmpty(el, 'Our popular picks are coming soon.');
    el.innerHTML = products.map(renderProductCard).join('');
  } catch (err) {
    console.error(err);
    renderError(el, 'We could not load our popular items.', loadPopular);
  }
}

bindProductGrid($('#popular-grid'));
loadPromos();
loadCategories();
loadPopular();