import { AppError } from '../utils/app-error.js';
import { decimal, installationTotal } from '../utils/decimal.js';
import { resolveImportBarangay } from './barangay.validator.js';

export function customerId(value) {
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d{0,19}$/.test(value) ||
    BigInt(value) > 18446744073709551615n
  ) {
    throw new AppError('Invalid customer ID.', 400);
  }
  return value;
}

export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const textLimits = {
  firstName: 60,
  middleName: 60,
  lastName: 60,
  street: 200,
  meterNumber: 120,
  meterKind: 120,
  meterSize: 40,
};
const dates = [
  'dateApplied',
  'dateApproved',
  'dateInstalled',
];
const checks = ['certificateReceived', 'contractReceived', 'acknowledgementReceived'];
const money = ['installationFee', 'setbackRate', 'reinstallationFee', 'violationFee'];
const quantity = ['reading', 'setbackLength'];
const fields = [
  ...Object.keys(textLimits),
  ...dates,
  ...checks,
  ...money,
  ...quantity,
  'barangayId',
  'barangayName',
  'extensionName',
  'gender',
  'contact',
  'address',
  'customerType',
  'natureOfWork',
  'serviceStatus',
  'username',
  'password',
  'revision',
  'duplicateReviewed',
  'account',
  'submitterNumber',
  'applicationNumber',
  'connectionStatus',
  'initialReading',
];

export function validateCustomer(body, { existing = null, importing = false } = {}) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !fields.includes(key))
  ) {
    throw new AppError('Provide valid customer fields only.', 400);
  }
  const result = {};
  if (
    body.duplicateReviewed !== undefined &&
    (importing || typeof body.duplicateReviewed !== 'boolean')
  )
    throw new AppError('Invalid duplicate review confirmation.', 400);
  result.duplicateReviewed = body.duplicateReviewed === true;
  for (const key of [
    'submitterNumber',
    'applicationNumber',
    'connectionStatus',
    'initialReading',
  ]) {
    if (body[key] !== undefined && !importing)
      throw new AppError('Only imports may restore ' + key + '.', 400);
  }
  if (importing) {
    for (const key of ['submitterNumber', 'applicationNumber']) {
      const value = body[key] || '';
      if (typeof value !== 'string' || (value && !/^[A-Za-z0-9_-]{3,40}$/.test(value.trim())))
        throw new AppError('Provide a valid ' + key + '.', 400);
      result[key] = value.trim();
    }
    if (body.connectionStatus) {
      if (!['Active', 'Inactive', 'Disconnected'].includes(body.connectionStatus))
        throw new AppError('Select a valid connection status.', 400);
      result.connectionStatus = body.connectionStatus;
    }
  }
  if (body.account !== undefined) {
    if (
      !importing ||
      typeof body.account !== 'string' ||
      !/^[A-Za-z0-9_-]{3,40}$/.test(body.account.trim())
    ) {
      throw new AppError('Only imports may provide a valid existing account number.', 400);
    }
    result.account = body.account.trim();
  }
  for (const [key, limit] of Object.entries(textLimits)) {
    const value = body[key] ?? '';
    if (
      typeof value !== 'string' ||
      value.trim().length > limit ||
      /[<>\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new AppError('Check ' + key + ': maximum ' + limit + ' characters.', 400);
    }
    result[key] = value.trim();
  }
  for (const key of ['firstName', 'middleName', 'lastName']) {
    if (
      (!result[key] && key !== 'middleName') ||
      (result[key] && (!/^[\p{L}\p{M} .,'-]+$/u.test(result[key]) || !/\p{L}/u.test(result[key])))
    ) {
      throw new AppError('Provide valid first, middle and last names.', 400);
    }
  }
  for (const [key, allowed, fallback] of [
    ['extensionName', ['', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'], ''],
    ['gender', ['Male', 'Female'], ''],
    ['customerType', ['Residential', 'Commercial'], 'Residential'],
    ['serviceStatus', ['Pending', 'Approved', 'Installed'], 'Pending'],
    [
      'natureOfWork',
      ['New connection', 'Reconnection', 'Meter replacement', 'Service repair'],
      'New connection',
    ],
  ]) {
    const value = body[key] || fallback;
    if (!allowed.includes(value)) throw new AppError('Select a valid ' + key + '.', 400);
    result[key] = value;
  }
  if (importing && !body.serviceStatus) result.serviceStatus = 'Approved';
  if (importing && body.barangayName !== undefined) {
    if (body.barangayId !== undefined)
      throw new AppError('Provide either barangay ID or name for each import row.', 400);
    result.barangayName = resolveImportBarangay(body.barangayName).name;
  } else {
    if (body.barangayName !== undefined) throw new AppError('Select a registered barangay.', 400);
    result.barangayId = customerId(body.barangayId);
  }
  result.address = body.address;
  if (typeof result.address !== 'string' || !/^Purok [1-7]$/.test(result.address))
    throw new AppError('Select Purok 1 to Purok 7.', 400);
  result.contact =
    typeof body.contact === 'string' ? body.contact.trim().replace(/^(?:\+?63|0)/, '') : '';
  if (!/^9\d{9}$/.test(result.contact))
    throw new AppError('Provide a valid Philippine mobile number.', 400);
  result.contact = '+63' + result.contact;
  for (const key of dates) {
    const value = body[key] || '';
    if (
      typeof value !== 'string' ||
      (value &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          !Number.isFinite(Date.parse(value)) ||
          new Date(value).toISOString().slice(0, 10) !== value ||
          value > today()))
    ) {
      throw new AppError('Provide a valid non-future ' + key + '.', 400);
    }
    result[key] = value;
  }
  result.dateApplied = existing?.dateApplied || (importing && result.dateApplied) || today();
  result.dateApproved =
    result.serviceStatus === 'Pending'
      ? ''
      : existing?.dateApproved || (importing && result.dateApproved) || today();
  for (const key of checks) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean')
      throw new AppError('Invalid document checklist.', 400);
    result[key] = importing && body[key] === undefined ? true : Boolean(body[key]);
  }
  // Complete imported installation records are ready for billing immediately.
  // Preserve explicitly disconnected records when restoring an exported workbook.
  if (importing && result.meterNumber && result.dateInstalled &&
      checks.every((key) => result[key]) && result.connectionStatus !== 'Disconnected') {
    result.serviceStatus = 'Installed';
    result.connectionStatus = 'Active';
    result.dateApproved = body.dateApproved || result.dateInstalled;
  }
  if (result.dateApproved && result.dateApproved < result.dateApplied)
    throw new AppError('Approval date cannot precede application.', 400);
  if (importing && result.connectionStatus === 'Active' && result.serviceStatus !== 'Installed')
    throw new AppError('Active connections require Installed service status.', 400);
  if (result.dateInstalled && result.dateInstalled < (result.dateApproved || result.dateApplied)) {
    throw new AppError('Installation date cannot precede application or approval.', 400);
  }
  if (result.serviceStatus === 'Installed' && (!result.dateInstalled || !result.meterNumber)) {
    throw new AppError('Installed accounts require meter number and installation date.', 400);
  }
  if (Boolean(result.meterNumber) !== Boolean(result.dateInstalled)) {
    throw new AppError('Enter both meter number and installation date, or leave both blank.', 400);
  }
  for (const key of money) result[key] = decimal(body[key] ?? '0', 2, 10, key);
  for (const key of quantity) result[key] = decimal(body[key] ?? '0', 3, 12, key);
  if (!result.meterNumber && Number(result.reading))
    throw new AppError('A reading requires an installed meter.', 400);
  if (importing) {
    result.initialReading = decimal(body.initialReading ?? result.reading, 3, 12, 'initialReading');
    if (Number(result.initialReading) > Number(result.reading))
      throw new AppError('Initial reading cannot exceed current reading.', 400);
  }
  result.installationTotal = installationTotal(result);
  result.username = typeof body.username === 'string' ? body.username.trim() : '';
  result.password = body.password ?? '';
  if (
    typeof result.password !== 'string' ||
    (result.password && (result.password.length < 8 || result.password.length > 128))
  ) {
    throw new AppError('Consumer password must contain 8–128 characters.', 400);
  }
  if (result.username && !/^(?!.*[<>])[\x21-\x7e]{3,40}$/.test(result.username)) {
    throw new AppError(
      'Username must contain 3–40 characters using letters, numbers or symbols, without spaces or angle brackets.',
      400,
    );
  }
  if (
    (!importing && result.username && !existing?.userId && !result.password) ||
    (result.password && !result.username)
  ) {
    throw new AppError('Provide both username and password to create a consumer account.', 400);
  }
  if (existing?.userId && !result.username)
    throw new AppError('An existing consumer username cannot be cleared.', 400);
  if (existing && (typeof body.revision !== 'string' || !body.revision))
    throw new AppError('Reload the customer before saving changes.', 409);
  result.revision = body.revision;
  return result;
}

export function validateCustomerQuery(query) {
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (
      typeof value !== 'string' ||
      !/^\d+$/.test(value) ||
      Number(value) < 1 ||
      Number(value) > max
    ) {
      throw new AppError('Invalid pagination parameters.', 400);
    }
    return Number(value);
  };
  const search = query.search || '';
  if (typeof search !== 'string' || search.length > 100)
    throw new AppError('Search is too long.', 400);
  const status = query.status || '';
  const type = query.type || '';
  if (
    !['', 'registered', 'pending', 'inactive'].includes(status) ||
    !['', 'Residential', 'Commercial'].includes(type)
  ) {
    throw new AppError('Invalid customer filters.', 400);
  }
  return {
    page: integer(query.page, 1, 1000000),
    limit: integer(query.limit, 10, 100),
    search: search.trim(),
    status,
    type,
    barangayId: query.barangayId ? customerId(query.barangayId) : '',
  };
}
