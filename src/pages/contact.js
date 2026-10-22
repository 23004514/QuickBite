import '../styles/shop.css';
import { supabase } from '../supabase.js';
import { setBusy, showMessage, EMAIL_RE } from '../utils/forms.js';
import { $ } from '../utils/dom.js';

const form = $('#contact-form');
const msg = $('#form-msg');
const button = $('button[type="submit"]', form);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage(msg, '');

  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const subject = form.subject.value.trim();
  const message = form.message.value.trim();

  if (!name) return showMessage(msg, 'Please enter your name.');
  if (!EMAIL_RE.test(email)) return showMessage(msg, 'Please enter a valid email address.');
  if (!message) return showMessage(msg, 'Please enter a message.');

  // Bots fill hidden fields; pretend success without storing anything.
  if (form.website.value) {
    form.reset();
    return showMessage(msg, 'Thanks! Your message has been sent.', 'success');
  }

  setBusy(button, true, 'Sending…');
  // No .select(): visitors may insert messages but never read them back (RLS).
  const { error } = await supabase
    .from('contact_messages')
    .insert({ name, email, subject: subject || null, message });
  setBusy(button, false);

  if (error) {
    console.error(error);
    return showMessage(msg, 'We could not send your message. Please try again later.');
  }
  form.reset();
  showMessage(msg, 'Thanks! Your message has been sent.', 'success');
});