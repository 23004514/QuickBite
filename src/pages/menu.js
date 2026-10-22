import '../styles/catalogue.css';
import { fetchCategories, fetchProducts } from '../services/products.js';
import { renderProductCard, bindProductGrid } from '../components/productCard.js';
import { skeletonCards, renderError, renderEmpty } from '../components/states.js';
import { escapeHtml, debounce, $ } from '../utils/dom.js';

const SORTS = ['popular', 'price-asc', 'price-desc', 'name'];
const state = { q: '', category: '', sort: 'popular' };
let requestId = 0;
let categories = [];

const grid = $('#product-grid');
const chips = $('#category-chips');
const count = $('#result-count');
const searchInput = $('#search');
const sortSelect = $('#sort');

function readUrl() {
  const params = new URLSearchParams(location.search);
  state.q = (params.get('q') || '').slice(0, 60);
  state.category = params.get('category') || '';
  const sort = params.get('sort');
  state.sort = SORTS.includes(sort) ? sort : 'popular';
}

function writeUrl() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.sort !== 'popular') params.set('sort', state.sort);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function renderChips() {
  const all = [{ slug: '', name: 'All' }, ...categories];
  chips.innerHTML = all
    .map(
      (c) => `
      <button type="button" class="chip" data-slug="${escapeHtml(c.slug)}"
        aria-pressed="${state.category === c.slug}">${escapeHtml(c.name)}</button>`
    )
    .join('');
}

async function load() {
  const id = ++requestId;
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = skeletonCards(8);

  try {
    const products = await fetchProducts({
      search: state.q,
      categorySlug: state.category,
      sort: state.sort,
    });
    if (id !== requestId) return; // a newer request replaced this one

    count.textContent = `${products.length} ${products.length === 1 ? 'item' : 'items'}`;
    if (!products.length) {
      renderEmpty(grid, 'No items match your search. Try a different word or category.');
    } else {
      grid.innerHTML = products.map(renderProductCard).join('');
    }
  } catch (err) {
    if (id !== requestId) return;
    console.error(err);
    count.textContent = '';
    renderError(grid, 'We could not load the menu. Please check your connection.', load);
  } finally {
    if (id === requestId) grid.removeAttribute('aria-busy');
  }
}

async function init() {
  readUrl();
  searchInput.value = state.q;
  sortSelect.value = state.sort;
  bindProductGrid(grid);

  try {
    categories = await fetchCategories();
    if (state.category && !categories.some((c) => c.slug === state.category)) {
      state.category = ''; // unknown category in the URL
    }
  } catch (err) {
    console.error('Categories failed to load', err);
  }
  renderChips();
  load();
}

chips.addEventListener('click', (event) => {
  const btn = event.target.closest('.chip');
  if (!btn) return;
  state.category = btn.dataset.slug;
  renderChips();
  writeUrl();
  load();
});

searchInput.addEventListener(
  'input',
  debounce(() => {
    state.q = searchInput.value.trim();
    writeUrl();
    load();
  }, 300)
);

sortSelect.addEventListener('change', () => {
  state.sort = SORTS.includes(sortSelect.value) ? sortSelect.value : 'popular';
  writeUrl();
  load();
});

init();