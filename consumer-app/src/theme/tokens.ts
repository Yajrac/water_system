export const colors = {
  background: '#f3f7f9',
  surface: '#ffffff',
  ink: '#173344',
  muted: '#6b7f8d',
  border: '#dce6ec',
  primary: '#087fa3',
  tint: '#e9f5fa',
  success: '#217553',
  successTint: '#eaf6ef',
  warning: '#996519',
  warningTint: '#fff5e3',
};

export const money = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
