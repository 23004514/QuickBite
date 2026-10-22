import '../styles/shop.css';
import { signUp, safeNext } from '../services/auth.js';
import { setBusy, showMessage, authErrorMessage, EMAIL_RE } from '../utils/forms.js';
import { $ } from '../utils/dom.js';

const form = $('#register-form');
const msg = $('#form-msg');
const button = $('button[type="submit"]', form);

const params = new URLSearchParams(location.search);
const next = safeNext(params.get('next'));
if (params.get('next')) {
  $('#login-link').href = `/login.html?next=${encodeURIComponent(next)}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(msg, '');

  const fullName = form.full_name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (fullName.length < 2) return showMessage(msg, 'Please enter your full name.');
  if (!EMAIL_RE.test(email)) return showMessage(msg, 'Please enter a valid email address.');
  if (password.length < 8) return showMessage(msg, 'Your password must be at least 8 characters.');
  if (password !== form.confirm.value) return showMessage(msg, 'The passwords do not match.');

  setBusy(button, true, 'Creating account…');
  const { data, error } = await signUp({ email, password, fullName });
  if (error) {
    showMessage(msg, authErrorMessage(error));
    setBusy(button, false);
    return;
  }

  if (data.session) {
    // Email confirmation is switched off: the user is already signed in.
    location.assign(next);
    return;
  }

  form.hidden = true;
  showMessage(
    msg,
    'Account created. Please check your email for a confirmation link, then log in.',
    'success'
  );
});