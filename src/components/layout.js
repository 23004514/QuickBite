import { APP, NAV_LINKS } from '../config.js';
import { escapeHtml, $ } from '../utils/dom.js';
import { getSession, onAuthChange, signOut } from '../services/auth.js';

function cartCount() {
  try {
    const items = JSON.parse(localStorage.getItem(APP.cartStorageKey) || '[]');
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  } catch {
    return 0;
  }
}

export function renderHeader(signedIn = false) {
  const mount = $('#site-header');
  if (!mount) return;

  const current = location.pathname === '/' ? '/index.html' : location.pathname;
  const aria = (href) => (href === current ? ' aria-current="page"' : '');

  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="nav__link"${aria(l.href)}>${escapeHtml(l.label)}</a>`
  ).join('');

  const authLinks = signedIn
    ? `<a href="/account.html" class="nav__link"${aria('/account.html')}>Account</a>
       <a href="#" class="nav__link" id="logout-link">Log out</a>`
    : `<a href="/login.html" class="nav__link"${aria('/login.html')}>Log in</a>`;

  mount.innerHTML = `
    <header class="header">
      <div class="container header__inner">
        <a href="/index.html" class="brand" aria-label="${APP.name} home">
          Quick<span class="brand__accent">Bite</span>
        </a>
        <button class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
        <nav id="site-nav" class="nav" aria-label="Main">
          ${links}
          ${authLinks}
          <a href="/cart.html" class="btn btn--accent btn--sm" aria-label="Cart">
            Cart <span class="cart-badge" id="cart-badge">${cartCount()}</span>
          </a>
        </nav>
      </div>
    </header>`;

  const toggle = $('.nav-toggle', mount);
  const nav = $('#site-nav', mount);
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('nav--open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// Renders the header, then updates it once the auth state is known and whenever it changes.
export function initHeader() {
  renderHeader(false);
  getSession()
    .then((session) => renderHeader(!!session))
    .catch(() => {});
  onAuthChange((_event, session) => renderHeader(!!session));

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#logout-link')) return;
    event.preventDefault();
    signOut().finally(() => location.assign('/index.html'));
  });
}

export function renderFooter() {
  const mount = $('#site-footer');
  if (!mount) return;
  mount.innerHTML = `
    <footer class="footer">
      <div class="container footer__inner">
        <p>&copy; ${new Date().getFullYear()} ${APP.name}. All rights reserved.</p>
        <nav aria-label="Footer">
          <a href="/about.html">About</a>
          <a href="/contact.html">Contact</a>
        </nav>
      </div>
    </footer>`;
}

export function updateCartBadge() {
  const badge = $('#cart-badge');
  if (badge) badge.textContent = String(cartCount());
}