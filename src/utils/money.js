// Work in integer cents to avoid floating-point errors. Display only: the server decides real totals.
export const toCents = (amount) => Math.round(Number(amount) * 100);
export const fromCents = (cents) => cents / 100;