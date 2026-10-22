export const PHONE_RE = /^[0-9+()\s-]{7,20}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function setBusy(button, busy, busyLabel = 'Please wait…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    if (button.dataset.label) {
      button.textContent = button.dataset.label;
      delete button.dataset.label;
    }
    button.disabled = false;
  }
}

export function showMessage(el, message, type = 'error') {
  if (!el) return;
  el.textContent = message || '';
  el.className = `form-msg form-msg--${type}`;
  el.hidden = !message;
}

export function authErrorMessage(error) {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login')) {
    return 'Incorrect email or password.';
  }
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
    return 'Please confirm your email address first. Check your inbox for the link.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (error?.status === 429 || code.includes('rate_limit') || msg.includes('rate limit')) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (code === 'weak_password') {
    return 'Please choose a stronger password (at least 8 characters).';
  }
  if (code === 'same_password') {
    return 'Please choose a password different from your current one.';
  }
  return 'Something went wrong. Please try again.';
}