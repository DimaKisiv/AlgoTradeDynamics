/** Number / currency / percent / date formatters. */

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct2 = new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtMoney = (n, decimals = 2) => (decimals === 0 ? usd0 : usd2).format(n ?? 0);

export const fmtPct = (n) => `${pct2.format(n ?? 0)}%`;

export const fmtPctSigned = (n) => `${n >= 0 ? '+' : ''}${pct2.format(n ?? 0)}%`;

export const fmtMoneySigned = (n) => `${n >= 0 ? '+' : ''}${usd2.format(n ?? 0)}`;

export const fmtNumber = (n, decimals = 2) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n ?? 0);

export const fmtDate = (iso) => {
  if (!iso) {return '—';}
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {return iso;}
  return d.toLocaleDateString('uk-UA', { year: 'numeric', month: 'short', day: '2-digit' });
};

export const fmtDateTime = (iso) => {
  if (!iso) {return '—';}
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {return iso;}
  return d.toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
};

export const fmtCompact = (n) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);
