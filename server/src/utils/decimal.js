import { AppError } from './app-error.js';

export function decimal(value, scale, integerDigits, label) {
  const raw = String(value ?? '0').trim();
  if (!new RegExp('^\\d{1,' + integerDigits + '}(?:\\.\\d{1,' + scale + '})?$').test(raw)) {
    throw new AppError(
      label + ' must be a non-negative number with up to ' + scale + ' decimals.',
      400,
    );
  }
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole).toString() + '.' + fraction.padEnd(scale, '0');
}

export function scaled(value, scale) {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'));
}

export function installationTotal(details) {
  const setback =
    (scaled(details.setbackLength, 3) * scaled(details.setbackRate, 2) + 500n) / 1000n;
  const cents =
    scaled(details.installationFee, 2) +
    setback +
    scaled(details.reinstallationFee, 2) +
    scaled(details.violationFee, 2);
  if (cents > 999999999999999n) throw new AppError('The installation estimate is too large.', 400);
  return Number(cents) / 100;
}
