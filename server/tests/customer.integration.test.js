import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';

test(
  'customer API integration in a disposable MariaDB database',
  {
    skip: process.env.CUSTOMER_INTEGRATION_TEST !== '1',
  },
  async () => {
    const { default: mysql } = await import('mysql2/promise');
    const { databaseOptions } = await import('../src/config/database.js');
    const options = await databaseOptions();
    const control = await mysql.createConnection({ ...options, multipleStatements: true });
    const name = 'pwss_customer_test_' + randomBytes(8).toString('hex');
    assert.match(name, /^pwss_customer_test_[a-f0-9]{16}$/);
    let server;
    let pool;
    let createdDatabase = false;
    try {
      await control.query(
        'CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
      );
      createdDatabase = true;
      await control.query('USE `' + name + '`');
      const migrations = new URL('../database/migrations/', import.meta.url);
      for (const file of (await readdir(migrations))
        .filter((file) => file.endsWith('.sql'))
        .sort()) {
        await control.query(await readFile(new URL(file, migrations), 'utf8'));
      }
      process.env.DB_NAME = name;
      process.env.JWT_SECRET = randomBytes(48).toString('hex');
      const { hashPassword, verifyPassword } = await import('../src/utils/password.js');
      const { default: app } = await import('../src/app.js');
      ({ pool } = await import('../src/database/pool.js'));
      const { authConfig } = await import('../src/config/auth.js');
      const { default: jwt } = await import('jsonwebtoken');
      const adminPassword = randomBytes(24).toString('hex');
      await control.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
        ['test.admin', await hashPassword(adminPassword)],
      );
      await control.execute(
        "INSERT INTO barangays (psgc_code, name) VALUES ('0500513001', 'Barangay Agol')",
      );
      const token = jwt.sign({}, authConfig.secret, {
        algorithm: 'HS256',
        subject: '1',
        expiresIn: '5m',
        issuer: authConfig.issuer,
        audience: authConfig.audience,
      });
      server = app.listen(0, '127.0.0.1');
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
      const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
      async function request(path, method = 'GET', body, accessToken = token) {
        const response = await fetch(base + path, {
          method,
          headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, ...(await response.json()) };
      }
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      assert.equal(
        (await request('/barangays/1', 'PUT', { psgcCode: '0500513001', name: 'Barangay Agol' }))
          .status,
        404,
      );
      const password = randomBytes(24).toString('hex');
      const setupBody = { barangayId: '1', month: today.slice(0, 7), due: today, rate: '7.00' };
      assert.equal(
        (await request('/billing-setups?month=' + setupBody.month, 'GET', undefined, '')).status,
        401,
      );
      const setup = await request('/billing-setups', 'PUT', setupBody);
      assert.equal(setup.status, 200, JSON.stringify(setup));
      assert.equal(setup.data.rate, '7.00');
      const setupAgain = await request('/billing-setups', 'PUT', setupBody);
      assert.equal(setupAgain.data.id, setup.data.id);
      assert.equal((await request('/billing-setups?month=' + setupBody.month)).data.length, 1);
      const [[setupLogs]] = await control.query(
        "SELECT COUNT(*) AS total FROM activity_logs WHERE entity_type = 'billing_setup'",
      );
      assert.equal(Number(setupLogs.total), 1);
      const body = {
        firstName: 'Ana',
        middleName: '',
        lastName: 'Reyes',
        gender: 'Female',
        contact: '09123456789',
        address: 'Purok 1',
        barangayId: '1',
        serviceStatus: 'Installed',
        certificateReceived: true,
        contractReceived: true,
        acknowledgementReceived: true,
        acknowledgementDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
        contractDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
        meterNumber: 'TEST-METER-1',
        dateInstalled: today,
        reading: '400',
        username: 'ana.reyes',
        password,
      };
      const added = await request('/customers', 'POST', body);
      assert.equal(added.status, 201, JSON.stringify(added));
      const customer = added.data;
      assert.equal(customer.reading, 400);
      assert.equal(customer.active, true);
      assert.equal(customer.password, undefined);
      assert.equal(customer.password_hash, undefined);
      assert.equal(customer._credentialRevision, undefined);
      const [[user]] = await control.execute('SELECT password_hash, role FROM users WHERE id = ?', [
        customer.userId,
      ]);
      assert.equal(user.role, 'consumer');
      assert.equal(await verifyPassword(user.password_hash, password), true);
      const login = await request('/auth/login', 'POST', { username: 'ana.reyes', password });
      assert.equal(login.status, 200);
      assert.equal(
        (await request('/customers', 'GET', undefined, login.data.accessToken)).status,
        403,
      );
      const listed = await request('/customers?search=Ana&limit=10');
      assert.equal(listed.data.pagination.total, 1);
      assert.equal((await request('/customers/' + customer.id)).data.bills.length, 0);
      const editBody = { ...body, firstName: 'Anna', password: '', revision: customer.revision };
      const edited = await request('/customers/' + customer.id, 'PUT', editBody);
      assert.equal(edited.status, 200, JSON.stringify(edited));
      assert.equal(edited.data.firstName, 'Anna');
      const [[unchangedHash]] = await control.execute(
        'SELECT password_hash FROM users WHERE id = ?',
        [customer.userId],
      );
      assert.equal(unchangedHash.password_hash, user.password_hash);
      const replacement = randomBytes(24).toString('hex');
      const reset = await request('/customers/' + customer.id, 'PUT', {
        ...editBody,
        password: replacement,
        revision: edited.data.revision,
      });
      assert.equal(reset.status, 200);
      const [[resetUser]] = await control.execute('SELECT password_hash FROM users WHERE id = ?', [
        customer.userId,
      ]);
      assert.equal(await verifyPassword(resetUser.password_hash, replacement), true);
      assert.equal(await verifyPassword(resetUser.password_hash, password), false);
      assert.equal((await request('/customers/' + customer.id, 'PUT', editBody)).status, 409);
      assert.equal((await request('/customers', 'POST', body)).status, 409);
      const [[count]] = await control.query('SELECT COUNT(*) AS total FROM customers');
      assert.equal(Number(count.total), 1);
      const inactive = await request('/customers/' + customer.id + '/status', 'PATCH', {
        status: 'Inactive',
        reason: 'Integration test',
        revision: reset.data.revision,
      });
      assert.equal(inactive.status, 200);
      const [[events]] = await control.query('SELECT COUNT(*) AS total FROM connection_events');
      assert.equal(Number(events.total), 1);
      const importRow = {
        account: 'LEGACY-001',
        firstName: 'Juan',
        lastName: 'Cruz',
        gender: 'Male',
        contact: '09123456789',
        address: 'Purok 2',
        barangayId: '1',
      };
      assert.equal(
        (await request('/customers/import', 'POST', { customers: [importRow, importRow] })).status,
        409,
      );
      const [[afterFailure]] = await control.query('SELECT COUNT(*) AS total FROM customers');
      assert.equal(Number(afterFailure.total), 1);
      assert.equal(
        (await request('/customers/import', 'POST', { customers: [importRow] })).status,
        201,
      );
      assert.equal((await request('/customers?status=pending')).data.pagination.total, 1);
      assert.equal(Number((await request('/barangays')).data[0].customer_count), 2);
      // Save through the actual meter API, then verify persisted readings and conflicts.
      const activated = await request('/customers/' + customer.id + '/status', 'PATCH', {
        status: 'Active',
        reason: 'Integration meter entry test',
        revision: inactive.data.revision,
      });
      assert.equal(activated.status, 200);
      const entryBody = {
        setupId: setup.data.id,
        customerId: customer.id,
        meterId: customer.meterId,
        previous: '400',
        consumption: '100',
      };
      assert.equal(
        (await request('/meter-entries', 'PUT', entryBody, login.data.accessToken)).status,
        403,
      );
      const meterSaved = await request('/meter-entries', 'PUT', entryBody);
      assert.equal(meterSaved.status, 200, JSON.stringify(meterSaved));
      assert.equal(meterSaved.data.current, '500.000');
      assert.equal((await request('/meter-entries', 'PUT', entryBody)).status, 409);
      const meterList = await request('/meter-entries?setupId=' + setup.data.id);
      assert.equal(meterList.data.customers.length, 1);
      assert.equal(meterList.data.entries[0].consumption, '100.000');
      const updatedEntry = await request('/meter-entries', 'PUT', {
        ...entryBody,
        consumption: '1',
        revision: meterSaved.data.revision,
      });
      assert.equal(updatedEntry.status, 200);
      assert.equal(updatedEntry.data.current, '401.000');
      assert.equal(
        (
          await request('/meter-entries', 'PUT', {
            ...entryBody,
            previous: '399',
            revision: updatedEntry.data.revision,
          })
        ).status,
        409,
      );
      assert.equal(
        (await request('/billing-setups', 'PUT', { ...setupBody, rate: '8.00' })).status,
        409,
      );
      const fresh = (await request('/customers/' + customer.id)).data.customer;
      const blocked = await request('/customers/' + customer.id, 'PUT', {
        ...editBody,
        reading: '401',
        revision: fresh.revision,
      });
      assert.equal(blocked.status, 409);
      assert.equal((await request('/customers/' + customer.id)).data.customer.reading, 400);
      // Preview is read-only, stale previews fail, and competing generations cannot duplicate bills.
      const firstPreview = await request('/bills/preview', 'POST', { setupId: setup.data.id });
      assert.equal(firstPreview.status, 200, JSON.stringify(firstPreview));
      const revisedEntry = await request('/meter-entries', 'PUT', {
        ...entryBody,
        consumption: '2',
        revision: updatedEntry.data.revision,
      });
      assert.equal(revisedEntry.status, 200);
      assert.equal(
        (
          await request('/bills/generate', 'POST', {
            setupId: setup.data.id,
            revision: firstPreview.data.revision,
          })
        ).status,
        409,
      );
      const finalPreview = await request('/bills/preview', 'POST', { setupId: setup.data.id });
      assert.equal(finalPreview.data.bills[0].total, '14.00');
      const generationBody = { setupId: setup.data.id, revision: finalPreview.data.revision };
      await control.query(`CREATE TRIGGER fail_bill_audit BEFORE INSERT ON activity_logs FOR EACH ROW
        BEGIN IF NEW.action = 'bills.generated' THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected test audit failure';
        END IF; END`);
      assert.equal((await request('/bills/generate', 'POST', generationBody)).status, 500);
      const [[rolledBackBills]] = await control.query('SELECT COUNT(*) AS total FROM bills');
      assert.equal(Number(rolledBackBills.total), 0);
      assert.equal((await request('/customers/' + customer.id)).data.customer.reading, 400);
      assert.equal(
        (await request('/meter-entries?setupId=' + setup.data.id)).data.entries[0].status,
        'Saved',
      );
      await control.query('DROP TRIGGER fail_bill_audit');
      const parallel = await Promise.all([
        request('/bills/generate', 'POST', generationBody),
        request('/bills/generate', 'POST', generationBody),
      ]);
      assert.deepEqual(parallel.map((result) => result.status).sort(), [201, 409]);
      const generated = await request('/bills?month=' + setupBody.month + '&search=Anna');
      assert.equal(generated.status, 200, JSON.stringify(generated));
      assert.equal(generated.data.pagination.total, 1);
      assert.equal(generated.data.bills[0].total, '14.00');
      assert.equal(generated.data.bills[0].status, 'Unpaid');
      assert.equal((await request('/bills?status=Paid')).data.pagination.total, 0);
      assert.equal((await request('/customers/' + customer.id)).data.customer.reading, 402);
      const billedEntries = await request('/meter-entries?setupId=' + setup.data.id);
      assert.equal(billedEntries.data.entries[0].status, 'Billed');
      assert.equal(billedEntries.data.customers.length, 0);
      // Payments lock the bill, reject overpayment, and retry safely without duplicate receipts.
      const billId = generated.data.bills[0].id;
      const pay = {
        billId,
        amount: '4.00',
        expectedBalance: '14.00',
        method: 'Cash',
        requestKey: randomBytes(16).toString('hex'),
      };
      assert.equal((await request('/payments', 'POST', pay, login.data.accessToken)).status, 403);
      assert.equal((await request('/payments', 'POST', { ...pay, amount: '14.01' })).status, 400);
      await control.query(`CREATE TRIGGER fail_payment_audit BEFORE INSERT ON activity_logs FOR EACH ROW
        BEGIN IF NEW.action = 'payment.recorded' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Injected payment audit failure'; END IF; END`);
      assert.equal((await request('/payments', 'POST', pay)).status, 500);
      const [[rolledBackPayments]] = await control.query('SELECT COUNT(*) AS total FROM payments');
      assert.equal(Number(rolledBackPayments.total), 0);
      await control.query('DROP TRIGGER fail_payment_audit');
      const paid = await request('/payments', 'POST', pay);
      assert.equal(paid.status, 200, JSON.stringify(paid));
      assert.equal(paid.data.payment.balanceAfter, '10.00');
      const again = await request('/payments', 'POST', pay);
      assert.equal(again.data.payment.id, paid.data.payment.id);
      assert.equal((await request('/bills?billId=' + billId)).data.bills[0].balance, '10.00');
      const remaining = {
        ...pay,
        amount: '6.00',
        expectedBalance: '10.00',
        method: 'Bank transfer',
        reference: 'BANK-TEST',
      };
      const competing = await Promise.all([
        request('/payments', 'POST', { ...remaining, requestKey: randomBytes(16).toString('hex') }),
        request('/payments', 'POST', { ...remaining, requestKey: randomBytes(16).toString('hex') }),
      ]);
      assert.deepEqual(competing.map((result) => result.status).sort(), [200, 409]);
      const fullyPaid = await request('/payments', 'POST', {
        ...pay,
        amount: '4.00',
        expectedBalance: '4.00',
        requestKey: randomBytes(16).toString('hex'),
      });
      assert.equal(fullyPaid.data.payment.balanceAfter, '0.00');
      const oldReceipt = await request('/payments/' + paid.data.payment.id);
      assert.equal(oldReceipt.data.payment.balanceBefore, '14.00');
      assert.equal(oldReceipt.data.payment.balanceAfter, '10.00');
      assert.equal((await request('/payments', 'POST', pay)).data.payment.id, paid.data.payment.id);
      const history = await request('/payments?from=' + today + '&to=' + today);
      assert.equal(history.status, 200, JSON.stringify(history));
      assert.equal(history.data.pagination.total, 3);
      assert.equal(history.data.summary.collected, '14.00');
      assert.equal((await request('/bills?status=Paid')).data.pagination.total, 1);
      // Unknown registrations and duplicate customers must never leave partially registered areas.
      const { barangayId: unusedAreaId, ...importByName } = importRow;
      const named = { ...importByName, account: 'AUTO-001', barangayName: 'caratagan' };
      const autoPreview = await request('/customers/import/preview', 'POST', {
        customers: [named],
      });
      assert.deepEqual(autoPreview.data.barangaysToRegister, ['Barangay Caratagan']);
      assert.equal(Number((await request('/barangays')).data.length), 1);
      const invalidName = await request('/customers/import', 'POST', {
        customers: [{ ...named, barangayName: 'Unknown place' }],
      });
      assert.equal(invalidName.status, 400);
      const duplicatesInNewArea = { ...named, account: 'ROLLBACK-001', barangayName: 'banawan' };
      assert.equal(
        (
          await request('/customers/import', 'POST', {
            customers: [duplicatesInNewArea, duplicatesInNewArea],
          })
        ).status,
        409,
      );
      assert.equal((await request('/barangays')).data.length, 1);
      const autoImported = await request('/customers/import', 'POST', {
        customers: [named, { ...named, account: 'AUTO-002', barangayName: 'Barangay Caratagan' }],
      });
      assert.equal(autoImported.status, 201, JSON.stringify(autoImported));
      assert.equal(autoImported.data.barangaysRegistered, 1);
      assert.equal((await request('/barangays')).data.length, 2);
      const reusePreview = await request('/customers/import/preview', 'POST', {
        customers: [{ ...named, account: 'AUTO-003' }],
      });
      assert.equal(reusePreview.data.barangaysToRegister.length, 0);
      const partialRows = [
        named,
        { ...named, account: 'PARTIAL-001' },
        { ...named, account: 'PARTIAL-002', contact: 'invalid' },
      ];
      const partialPreview = await request('/customers/import/preview', 'POST', {
        customers: partialRows,
      });
      assert.equal(partialPreview.data.count, 1);
      assert.equal(partialPreview.data.rejectedCount, 2);
      assert.match(partialPreview.data.rows[0].reason, /already exists/);
      const partial = await request('/customers/import', 'POST', {
        customers: partialRows,
        reviewRevision: partialPreview.data.revision,
      });
      assert.equal(partial.status, 201, JSON.stringify(partial));
      assert.equal(partial.data.count, 1);
      assert.equal(partial.data.rejectedCount, 2);
      const staleRows = [{ ...named, account: 'STALE-001' }];
      const stalePreview = await request('/customers/import/preview', 'POST', {
        customers: staleRows,
      });
      assert.equal(
        (await request('/customers/import', 'POST', { customers: staleRows })).status,
        201,
      );
      assert.equal(
        (
          await request('/customers/import', 'POST', {
            customers: staleRows,
            reviewRevision: stalePreview.data.revision,
          })
        ).status,
        409,
      );
      const dashboard = await request('/dashboard');
      assert.equal(dashboard.status, 200, JSON.stringify(dashboard));
      const stats = dashboard.data.summary;
      assert.equal(stats.bills, 1);
      assert.equal(stats.paid, 1);
      assert.equal(stats.unpaidBills, 0);
      assert.equal(Number(stats.outstanding), 0);
      assert.equal(Number(stats.totalCollections), 14);
      assert.equal(Number(stats.todayCollections), 14);
      assert.equal(Number(stats.monthCollections), 14);
      assert.equal(dashboard.data.monthlyCollections.length, 6);
      assert.equal(Number(dashboard.data.monthlyCollections.at(-1).amount), 14);
      assert.equal(
        dashboard.data.barangayConsumption.reduce((sum, row) => sum + Number(row.volume), 0),
        2,
      );
      const [[customerCount]] = await control.query('SELECT COUNT(*) AS count FROM customers');
      assert.equal(stats.totalCustomers, Number(customerCount.count));
      assert.equal((await request('/dashboard', 'GET', undefined, '')).status, 401);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (pool) await pool.end();
      // Only the generated disposable database is ever removed.
      if (createdDatabase) await control.query('DROP DATABASE IF EXISTS `' + name + '`');
      await control.end();
    }
  },
);
