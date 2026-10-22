import { APP } from '../config.js';

const money = new Intl.NumberFormat(APP.locale, {
  style: 'currency',
  currency: APP.currency,
});

export const formatZAR = (amount) => money.format(Number(amount) || 0);

export const formatDateTime = (iso) =>
  new Intl.DateTimeFormat(APP.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));