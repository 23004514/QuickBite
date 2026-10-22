import { escapeHtml, $ } from '../utils/dom.js';

export function skeletonCards(count = 8) {
  return Array.from({ length: count }, () => `
    <div class="card card--skeleton" aria-hidden="true">
      <div class="card__media skeleton"></div>
      <div class="card__body">
        <div class="skeleton skeleton--line"></div>
        <div class="skeleton skeleton--line skeleton--short"></div>
      </div>
    </div>`).join('');
}

export function renderError(el, message, retry) {
  el.innerHTML = `
    <div class="state state--error" role="alert">
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn btn--sm" data-retry>Try again</button>
    </div>`;
  $('[data-retry]', el).addEventListener('click', retry);
}

export function renderEmpty(el, message) {
  el.innerHTML = `<div class="state"><p>${escapeHtml(message)}</p></div>`;
}