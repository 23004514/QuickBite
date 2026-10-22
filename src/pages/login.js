import '../styles/shop.css';
import { signIn, getSession, safeNext, onAuthChange } from '../services/auth.js';
import { setBusy, showMessage, authErrorMessage, EMAIL_RE } from '../utils/forms.js';
import { $ } from '../utils/dom.js';

const form = $('#login-form');
const msg = $('#form-msg');
const button = $('button[type="submit"]', form);

const params = new URLSearchParams(location.search);
const next = safeNext(params.get('next'));
if (params.get('next')) {
  $('#register-link').href = `/register.html?next=${encodeURIComponent(next)}`;
}

// Already logged in: go straight on.
getSession()
  .then((session) => session && location.replace(next))
  .catch(() => {});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(msg, '');

  const email = form.email.value.trim();
  const password = form.password.value;
  if (!EMAIL_RE.test(email)) return showMessage(msg, 'Please enter a valid email address.');
  if (!password) return showMessage(msg, 'Please enter your password.');

  setBusy(button, true, 'Logging in…');
  const { error } = await signIn({ email, password });
  if (error) {
    showMessage(msg, authErrorMessage(error));
    setBusy(button, false);
    return;
  }
  location.assign(next);
});