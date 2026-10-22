import '../styles/shop.css';
import { sendPasswordReset, updatePassword, onAuthChange } from '../services/auth.js';
import { setBusy, showMessage, authErrorMessage, EMAIL_RE } from '../utils/forms.js';
import { $ } from '../utils/dom.js';

const msg = $('#form-msg');
const requestPanel = $('#request-panel');
const updatePanel = $('#update-panel');
const requestForm = $('#request-form');
const updateForm = $('#update-form');

function showUpdatePanel() {
  requestPanel.hidden = true;
  updatePanel.hidden = false;
}

// Arriving from the emailed link: Supabase signs the user into a recovery session.
if (location.hash.includes('type=recovery')) showUpdatePanel();
onAuthChange((event) => {
  if (event === 'PASSWORD_RECOVERY') showUpdatePanel();
});
if (location.hash.includes('error_code=otp_expired') || location.hash.includes('error=access_denied')) {
  showMessage(msg, 'This reset link is invalid or has expired. Please request a new one.');
}

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(msg, '');
  const email = requestForm.email.value.trim();
  if (!EMAIL_RE.test(email)) return showMessage(msg, 'Please enter a valid email address.');

  const button = $('button[type="submit"]', requestForm);
  setBusy(button, true, 'Sending…');
  const { error } = await sendPasswordReset(email);
  setBusy(button, false);

  if (error && (error.status === 429 || (error.code ?? '').includes('rate_limit'))) {
    return showMessage(msg, authErrorMessage(error));
  }
  // Same message whether or not the account exists, so emails can't be probed.
  showMessage(msg, 'If an account exists for that email, a reset link is on its way.', 'success');
  requestForm.reset();
});

updateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(msg, '');
  const password = updateForm.password.value;
  if (password.length < 8) return showMessage(msg, 'Your password must be at least 8 characters.');
  if (password !== updateForm.confirm.value) return showMessage(msg, 'The passwords do not match.');

  const button = $('button[type="submit"]', updateForm);
  setBusy(button, true, 'Updating…');
  const { error } = await updatePassword(password);
  if (error) {
    showMessage(msg, authErrorMessage(error));
    setBusy(button, false);
    return;
  }
  showMessage(msg, 'Password updated. Taking you to your account…', 'success');
  setTimeout(() => location.assign('/account.html'), 1500);
});