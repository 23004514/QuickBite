import './styles/base.css';
import { initHeader, renderFooter, updateCartBadge } from './components/layout.js';

initHeader();
renderFooter();

window.addEventListener('storage', updateCartBadge);
window.addEventListener('quickbite:cart-changed', updateCartBadge);