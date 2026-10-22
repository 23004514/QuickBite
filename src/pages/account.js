import '../styles/shop.css';
import { requireAuth, updatePassword, signOut } from '../services/auth.js';
import {
  fetchProfile, updateProfile, fetchAddresses, addAddress, deleteAddress,
} from '../services/account.js';
import { PHONE_RE, setBusy, showMessage, authErrorMessage } from '../utils/forms.js';
import { escapeHtml, $ } from '../utils/dom.js';

const MAX_ADDRESSES = 5;

const root = $('#account-root');
const profileForm = $('#profile-form');
const profileMsg = $('#profile-msg');
const addressForm = $('#address-form');
const addressMsg = $('#address-msg');
const addressList = $('#address-list');
const passwordForm = $('#password-form');
const passwordMsg = $('#password-msg');

let userId = null;
let addressCount = 0;

async function renderAddresses() {
  const list = await fetchAddresses();
  addressCount = list.length;
  addressList.innerHTML = list.length
    ? list
        .map(
          (a) => `
        <li class="addr">
          <div>
            <p><strong>${escapeHtml(a.label || 'Address')}</strong></p>
            <p>${escapeHtml(a.street)}${a.suburb ? ', ' + escapeHtml(a.suburb) : ''}, ${escapeHtml(a.city)} ${escapeHtml(a.postal_code ?? '')}</p>
          </div>
          <button type="button" class="link-btn" data-delete="${escapeHtml(a.id)}">Delete</button>
        </li>`
        )
        .join('')
    : '<li class="muted">No saved addresses yet.</li>';
}

async function init() {
  const session = await requireAuth();
  if (!session) return;
  userId = session.user.id;
  root.hidden = false;

  try {
    const profile = await fetchProfile(userId);
    $('#email').value = profile.email ?? session.user.email ?? '';
    profileForm.full_name.value = profile.full_name ?? '';
    profileForm.phone.value = profile.phone ?? '';
    await renderAddresses();
  } catch (err) {
    console.error(err);
    showMessage(profileMsg, 'We could not load your account details. Please refresh the page.');
  }
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(profileMsg, '');
  const fullName = profileForm.full_name.value.trim();
  const phone = profileForm.phone.value.trim();

  if (fullName.length > 100) return showMessage(profileMsg, 'Your name is too long.');
  if (phone && !PHONE_RE.test(phone)) return showMessage(profileMsg, 'Please enter a valid phone number.');

  const button = $('button[type="submit"]', profileForm);
  setBusy(button, true, 'Saving…');
  try {
    await updateProfile(userId, { full_name: fullName || null, phone: phone || null });
    showMessage(profileMsg, 'Profile saved.', 'success');
  } catch (err) {
    console.error(err);
    showMessage(profileMsg, 'We could not save your profile. Please try again.');
  } finally {
    setBusy(button, false);
  }
});

addressForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(addressMsg, '');
  const v = (name) => addressForm[name].value.trim();

  if (addressCount >= MAX_ADDRESSES) {
    return showMessage(addressMsg, `You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`);
  }
  if (!v('street') || !v('city')) {
    return showMessage(addressMsg, 'Street address and city are required.');
  }

  const button = $('button[type="submit"]', addressForm);
  setBusy(button, true, 'Adding…');
  try {
    await addAddress(userId, {
      label: v('label') || null,
      street: v('street'),
      suburb: v('suburb') || null,
      city: v('city'),
      postal_code: v('postal_code') || null,
      instructions: v('instructions') || null,
    });
    addressForm.reset();
    await renderAddresses();
    showMessage(addressMsg, 'Address saved.', 'success');
  } catch (err) {
    console.error(err);
    showMessage(addressMsg, 'We could not save that address. Please check the details.');
  } finally {
    setBusy(button, false);
  }
});

addressList.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-delete]');
  if (!btn) return;
  try {
    await deleteAddress(btn.dataset.delete);
    await renderAddresses();
  } catch (err) {
    console.error(err);
    showMessage(addressMsg, 'We could not delete that address.');
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(passwordMsg, '');
  const password = passwordForm.password.value;
  if (password.length < 8) return showMessage(passwordMsg, 'Your password must be at least 8 characters.');
  if (password !== passwordForm.confirm.value) return showMessage(passwordMsg, 'The passwords do not match.');

  const button = $('button[type="submit"]', passwordForm);
  setBusy(button, true, 'Updating…');
  const { error } = await updatePassword(password);
  setBusy(button, false);
  if (error) return showMessage(passwordMsg, authErrorMessage(error));
  passwordForm.reset();
  showMessage(passwordMsg, 'Password updated.', 'success');
});

$('#logout').addEventListener('click', () => {
  signOut().finally(() => location.assign('/index.html'));
});

init();