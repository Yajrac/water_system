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
        meterNumber: 'TEST-METER-1',
        dateInstalled: today,
        reading: '400',
        username: 'ana.reyes',
        password,
      };
      const added = await request('/customers', 'POST', body);
      assert.equal(added.status, 201, JSON.stringify(added));
      const customer = added.data;
      for (const contact of ['09123456789', '9123456789', '+639123456789']) {
        const checked = await request('/customers/check-duplicate', 'POST', { ...body, contact });
        assert.equal(checked.status, 200);
        assert.equal(checked.data.exists, true);
      }
      assert.equal((await request('/customers/check-duplicate', 'POST', {
        ...body, excludeId: customer.id,
      })).data.exists, false);
      assert.equal((await request('/customers/check-duplicate', 'POST', {
        ...body, contact: '09999999999',
      })).data.exists, false);
      const duplicate = await request('/customers', 'POST', {
        ...body, username: 'different.username', meterNumber: 'DIFFERENT-METER',
      });
      assert.equal(duplicate.status, 409);
      assert.match(duplicate.message, /possible duplicate/i);

      assert.equal(customer.reading, 400);
      assert.equal(customer.active, true);
      assert.equal(customer.mustChangePassword, false);
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
      assert.equal((await request('/notifications', 'GET', undefined, login.data.accessToken)).status, 403);
      const noticeBody = { type:'Announcement', audience:'customer', target:customer.id,
        message:'Test advisory for this customer',status:'Published' };
      const published = await request('/notifications','POST',noticeBody);
      assert.equal(published.status,201,JSON.stringify(published));
      assert.equal(published.data.recipients,1);
      await request('/notifications','POST',{...noticeBody,message:'Private draft',status:'Draft'});
      const feed = await request('/notifications/mine','GET',undefined,login.data.accessToken);
      assert.equal(feed.status,200,JSON.stringify(feed));
      assert.ok(feed.data.some(item=>item.body===noticeBody.message));
      assert.ok(!feed.data.some(item=>item.body==='Private draft'));
      assert.ok(feed.data.some(item=>item.category==='Application'));
      assert.equal((await request('/notifications','POST',{...noticeBody,target:'9999999'})).status,400);

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
      const [[usersAfterFailure]] = await control.query('SELECT COUNT(*) AS total FROM users');
      assert.equal(Number(usersAfterFailure.total), 2);
      assert.equal(
        (await request('/customers/import', 'POST', { customers: [importRow] })).status,
        201,
      );
      assert.equal((await request('/customers?status=pending')).data.pagination.total, 0);
      const imported = (await request('/customers?search=LEGACY-001')).data.customers[0];
      assert.equal(imported.serviceStatus, 'Approved');
      assert.equal(imported.active, false);
      assert.equal(imported.mustChangePassword, true);
      assert.equal(imported.certificateReceived, true);
      assert.equal(imported.contractReceived, true);
      assert.equal(imported.acknowledgementReceived, true);
      assert.ok(imported.username);
      const [[importUser]] = await control.execute('SELECT password_hash FROM users WHERE id = ?', [
        imported.userId,
      ]);
      assert.notEqual(importUser.password_hash, imported.submitterNumber);
      assert.equal(await verifyPassword(importUser.password_hash, imported.submitterNumber), true);
      const firstLogin = await request('/auth/login', 'POST', {
        username: imported.account,
        password: imported.submitterNumber,
      });
      assert.equal(firstLogin.status, 200, JSON.stringify(firstLogin));
      assert.equal(firstLogin.data.user.mustChangePassword, true);
      assert.ok(firstLogin.data.refreshToken);
      const renewedConsumer = await request('/auth/refresh', 'POST', {refreshToken:firstLogin.data.refreshToken});
      assert.equal(renewedConsumer.status,200);
      assert.equal(renewedConsumer.data.user.role,'consumer');
      assert.equal(renewedConsumer.data.user.mustChangePassword,true);
      assert.equal((await request('/consumer/profile','GET',undefined,firstLogin.data.refreshToken)).status,401);
      const temporaryToken = firstLogin.data.accessToken;
      assert.equal(
        (await request('/auth/me', 'GET', undefined, temporaryToken)).data.user.mustChangePassword,
        true,
      );
      const restricted = await request('/customers', 'GET', undefined, temporaryToken);
      assert.equal(restricted.status, 403);
      assert.match(restricted.message, /temporary password/);
      assert.equal(
        (
          await request(
            '/auth/change-password',
            'POST',
            { currentPassword: imported.submitterNumber, newPassword: imported.submitterNumber },
            temporaryToken,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/auth/change-password',
            'POST',
            { currentPassword: 'wrong-password', newPassword: 'password123' },
            temporaryToken,
          )
        ).status,
        400,
      );
      const changeBody = { currentPassword: imported.submitterNumber, newPassword: 'password123' };
      await control.query(
        "CREATE TRIGGER fail_password_audit BEFORE INSERT ON activity_logs FOR EACH ROW BEGIN IF NEW.action = 'consumer.password_changed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected failure'; END IF; END",
      );
      assert.equal(
        (await request('/auth/change-password', 'POST', changeBody, temporaryToken)).status,
        500,
      );
      assert.equal(
        (await request('/auth/me', 'GET', undefined, temporaryToken)).data.user.mustChangePassword,
        true,
      );
      assert.equal(
        (await request('/customers/' + imported.id)).data.customer.mustChangePassword,
        true,
      );
      await control.query('DROP TRIGGER fail_password_audit');
      assert.equal(
        (await request('/auth/change-password', 'POST', changeBody, temporaryToken)).status,
        200,
      );
      assert.equal((await request('/auth/me', 'GET', undefined, temporaryToken)).status, 401);
      const nextLogin = await request('/auth/login', 'POST', {
        username: imported.username,
        password: 'password123',
      });
      assert.equal(nextLogin.status, 200, JSON.stringify(nextLogin));
      assert.equal(nextLogin.data.user.mustChangePassword, false);
      assert.equal((await request('/auth/refresh','POST',{refreshToken:firstLogin.data.refreshToken})).status,401);
      const blockedPasswordChange = await request('/auth/change-password', 'POST', {
        currentPassword: 'password123', newPassword: 'anotherPassword123',
      }, nextLogin.data.accessToken);
      assert.equal(blockedPasswordChange.status, 429);
      assert.equal((await request('/auth/me', 'GET', undefined, nextLogin.data.accessToken)).status, 200);
      assert.equal(
        (await request('/customers/' + imported.id)).data.customer.mustChangePassword,
        false,
      );
      const [[changedUser]] = await control.execute(
        'SELECT password_hash FROM users WHERE id = ?',
        [imported.userId],
      );
      assert.equal(
        await verifyPassword(changedUser.password_hash, imported.submitterNumber),
        false,
      );
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
        (await request('/meter-entries', 'PUT', entryBody, nextLogin.data.accessToken)).status,
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
      assert.equal(
        (await request('/payments', 'POST', pay, nextLogin.data.accessToken)).status,
        403,
      );
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
      const partialFinances=await request('/consumer/finances','GET',undefined,
        jwt.sign({role:'consumer',version:1},authConfig.secret,{algorithm:'HS256',subject:String(customer.userId),expiresIn:'5m',issuer:authConfig.issuer,audience:authConfig.audience}));
      // Account password reset earlier increments its auth version once.
      assert.equal(partialFinances.status,200,JSON.stringify(partialFinances));
      assert.equal(Number(partialFinances.data.summary.balance),10);
      assert.equal(Number(partialFinances.data.bills[0].paid),4);
      assert.equal(Number(partialFinances.data.bills[0].balance),10);
      assert.notEqual(partialFinances.data.bills[0].status,'Paid');

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
      assert.equal(dashboard.data.monthlyCollections.length, 12);
      assert.equal(Number(dashboard.data.monthlyCollections.find(row => row.month === today.slice(0,7)).amount), 14);
      assert.equal(
        dashboard.data.barangayConsumption.reduce((sum, row) => sum + Number(row.volume), 0),
        2,
      );
      const [[customerCount]] = await control.query('SELECT COUNT(*) AS count FROM customers');
      assert.equal(stats.totalCustomers, Number(customerCount.count));
      assert.equal((await request('/dashboard', 'GET', undefined, '')).status, 401);
      const [[owner]] = await control.execute('SELECT auth_version FROM users WHERE id=?',[customer.userId]);
      const ownerToken = jwt.sign({role:'consumer',version:Number(owner.auth_version)},authConfig.secret,{
        algorithm:'HS256',subject:String(customer.userId),expiresIn:'5m',issuer:authConfig.issuer,audience:authConfig.audience,
      });
      const ownerFeed = await request('/notifications/mine','GET',undefined,ownerToken);
      assert.equal(ownerFeed.status,200,JSON.stringify(ownerFeed));
      assert.ok(ownerFeed.data.some(item=>item.category==='Billing'));
      assert.ok(ownerFeed.data.some(item=>item.category==='Payment'));
      const otherFeed = await request('/notifications/mine','GET',undefined,nextLogin.data.accessToken);
      assert.equal(otherFeed.status,200);
      assert.ok(!otherFeed.data.some(item=>item.body==='Test advisory for this customer'));
      assert.ok(!otherFeed.data.some(item=>item.category==='Payment'));
      const connections = await request('/customers/connections?state=active');
      assert.equal(connections.status,200,JSON.stringify(connections));
      const installed = connections.data.customers.find(row=>row.id===customer.id);
      assert.ok(installed);
      const disconnected = await request('/customers/'+customer.id+'/status','PATCH',{
        status:'Disconnected',reason:'Test service disconnection',revision:installed.revision,
      });
      assert.equal(disconnected.status,200,JSON.stringify(disconnected));
      assert.equal(disconnected.data.connectionStatus,'Disconnected');
      const openConnections = await request('/customers/connections?state=disconnected');
      assert.equal(openConnections.data.pagination.total,1);
      assert.equal(openConnections.data.customers[0].disconnectionReason,'Test service disconnection');
      assert.equal(Number(openConnections.data.customers[0].outstanding),0);
      const reconnect = {status:'Active',reason:'Service restored',revision:disconnected.data.revision};
      assert.equal((await request('/customers/'+customer.id+'/status','PATCH',{
        ...reconnect,revision:installed.revision,
      })).status,409);
      assert.equal((await request('/customers/'+customer.id+'/status','PATCH',reconnect)).status,200);
      assert.equal((await request('/customers/connections?state=disconnected')).data.pagination.total,0);
      const [[disconnectEvents]] = await control.execute("SELECT COUNT(*) AS total FROM connection_events WHERE customer_id=? AND new_status='Disconnected'",[customer.id]);
      assert.equal(Number(disconnectEvents.total),1);
      const ownProfile=await request('/consumer/profile','GET',undefined,ownerToken);
      assert.equal(ownProfile.status,200,JSON.stringify(ownProfile));
      assert.equal(ownProfile.data.account,customer.account);
      assert.equal(ownProfile.data.name,'Anna Reyes');
      assert.equal(ownProfile.data.gender,'Female');
      assert.equal(ownProfile.data.password_hash,undefined);
      assert.equal((await request('/consumer/profile','GET')).status,403);
      const submission=await request('/consumer/feedback','POST',{category:'Water supply',message:'Test low water pressure'},ownerToken);
      assert.equal(submission.status,201,JSON.stringify(submission));
      const mine=await request('/consumer/feedback','GET',undefined,ownerToken);
      assert.equal(mine.data.length,1);
      assert.equal(mine.data[0].message,'Test low water pressure');
      assert.equal(mine.data[0].internal_notes,undefined);
      const notMine=await request('/consumer/feedback','GET',undefined,nextLogin.data.accessToken);
      assert.equal(notMine.data.length,0);
      assert.equal((await request('/consumer/feedback','POST',{category:'Other',message:'x',customerId:'1'},ownerToken)).status,400);
      assert.equal((await request('/feedback','GET',undefined,ownerToken)).status,403);
      const feedbackList=await request('/feedback?status=New');
      assert.equal(feedbackList.status,200,JSON.stringify(feedbackList));
      assert.equal(feedbackList.data.pagination.total,1);
      assert.equal((await request('/feedback/unread')).data.unread,1);
      assert.equal((await request('/feedback/'+submission.data.id+'/read','POST',undefined,ownerToken)).status,403);
      assert.equal((await request('/feedback/not-an-id/read','POST')).status,400);
      assert.equal((await request('/feedback/999999999/read','POST')).status,404);
      assert.equal((await request('/feedback/'+submission.data.id+'/read','POST')).status,200);
      assert.equal((await request('/feedback/'+submission.data.id+'/read','POST')).status,200);
      assert.equal((await request('/feedback/unread')).data.unread,0);
      assert.equal((await request('/feedback/'+submission.data.id,'PATCH',{status:'Resolved',reply:'No replies'})).status,400);
      assert.equal((await request('/feedback/'+submission.data.id,'PATCH',{status:'Resolved'})).status,200);
      const resolved=await request('/consumer/feedback','GET',undefined,ownerToken);
      assert.equal(resolved.data[0].status,'Resolved');
      const [[messageCount]]=await control.execute('SELECT COUNT(*) AS total FROM feedback_messages WHERE thread_id=?',[submission.data.id]);
      assert.equal(Number(messageCount.total),1);
      const finances=await request('/consumer/finances','GET',undefined,ownerToken);
      assert.equal(finances.status,200,JSON.stringify(finances));
      assert.equal(finances.data.summary.billCount,1);
      assert.equal(Number(finances.data.summary.balance),0);
      assert.equal(Number(finances.data.summary.totalPaid),14);
      assert.equal(finances.data.bills[0].status,'Paid');
      const report = await request('/reports?status=Paid');
      assert.equal(report.status, 200, JSON.stringify(report));
      assert.equal(report.data.bills.length, 1);
      assert.equal(report.data.summary.total, '14.00');
      assert.equal(report.data.summary.paid, '14.00');
      assert.equal(report.data.summary.balance, '0.00');
      assert.equal(report.data.consumption[0].volume, '2.000');
      assert.equal(report.data.consumption[0].accounts, 1);
      assert.equal((await request('/reports?status=Unpaid')).data.bills.length, 0);
      assert.equal((await request('/reports?search=nonexistent-account')).data.bills.length, 0);
      assert.equal((await request('/reports?month=invalid')).status, 400);
      assert.equal((await request('/reports', 'GET', undefined, ownerToken)).status, 403);

      assert.equal(Number(finances.data.bills[0].consumption),2);
      assert.equal(finances.data.latestBill.id,finances.data.bills[0].id);
      assert.equal(finances.data.payments.length,3);
      const receipts=finances.data.payments.slice().sort((a,b)=>Number(a.id)-Number(b.id));
      assert.equal(Number(receipts[0].balanceBefore),14);
      assert.equal(Number(receipts[0].balanceAfter),10);
      assert.equal(Number(receipts[1].balanceBefore),10);
      assert.equal(Number(receipts[1].balanceAfter),4);
      assert.equal(Number(receipts[2].balanceBefore),4);
      assert.equal(Number(receipts[2].balanceAfter),0);
      assert.equal(receipts[1].method,'Bank transfer');
      assert.equal(receipts[1].reference,'BANK-TEST');
      const emptyFinances=await request('/consumer/finances','GET',undefined,nextLogin.data.accessToken);
      assert.equal(emptyFinances.status,200);
      assert.deepEqual(emptyFinances.data.bills,[]);
      assert.deepEqual(emptyFinances.data.payments,[]);
      assert.equal(emptyFinances.data.latestBill,null);
      assert.equal(Number(emptyFinances.data.summary.balance),0);
      const later=await request('/consumer/finances?billsPage=2&paymentsPage=2','GET',undefined,ownerToken);
      assert.equal(later.data.bills.length,0);
      assert.equal(later.data.payments.length,0);
      assert.equal(later.data.summary.billCount,1);
      assert.equal((await request('/consumer/finances?billsPage=-1','GET',undefined,ownerToken)).status,400);
      assert.equal((await request('/consumer/finances','GET')).status,403);
      // Newly provisioned admins must replace their temporary password, including after refresh.
      const { createAdminUser } = await import('../src/models/user.model.js');
      const temporaryAdminId = await createAdminUser('new.admin', await hashPassword('Temp123!'));
      const adminLogin = await request('/auth/login', 'POST', { username: 'new.admin', password: 'Temp123!' });
      assert.equal(adminLogin.status, 200);
      assert.equal(adminLogin.data.user.mustChangePassword, true);
      const adminAccess = adminLogin.data.accessToken;
      assert.equal((await request('/reports', 'GET', undefined, adminAccess)).status, 403);
      const renewedAdmin = await request('/auth/refresh', 'POST', { refreshToken: adminLogin.data.refreshToken });
      assert.equal(renewedAdmin.data.user.mustChangePassword, true);
      assert.equal((await request('/reports', 'GET', undefined, renewedAdmin.data.accessToken)).status, 403);
      assert.equal((await request('/auth/change-password', 'POST', {currentPassword:'wrong',newPassword:'password123'}, adminAccess)).status, 400);
      assert.equal((await request('/auth/change-password', 'POST', {currentPassword:'Temp123!',newPassword:'short'}, adminAccess)).status, 400);
      assert.equal((await request('/auth/change-password', 'POST', {currentPassword:'Temp123!',newPassword:'password123'}, adminAccess)).status, 200);
      assert.equal((await request('/auth/me', 'GET', undefined, adminAccess)).status, 401);
      assert.equal((await request('/auth/refresh', 'POST', {refreshToken:adminLogin.data.refreshToken})).status, 401);
      assert.equal((await request('/auth/login', 'POST', {username:'new.admin',password:'Temp123!'})).status, 401);
      const permanentAdmin = await request('/auth/login', 'POST', {username:'new.admin',password:'password123'});
      assert.equal(permanentAdmin.status, 200);
      assert.equal(permanentAdmin.data.user.mustChangePassword, false);
      assert.equal((await request('/reports', 'GET', undefined, permanentAdmin.data.accessToken)).status, 200);
      const [[adminPasswordLog]] = await control.execute("SELECT COUNT(*) AS total FROM activity_logs WHERE actor_id=? AND action='admin.password_changed'", [temporaryAdminId]);
      assert.equal(Number(adminPasswordLog.total), 1);
      for (let index = 0; index < 12; index++) {
        await control.execute("INSERT INTO activity_logs (actor_id,actor_role,action,description,created_at) VALUES (1,'admin','audit.probe',?,'2026-01-01 00:00:00')", ['audit-probe-' + index]);
      }
      for (const timestamp of ['2025-12-31 15:59:59', '2026-01-01 16:00:00']) {
        await control.execute("INSERT INTO activity_logs (actor_id,actor_role,action,description,created_at) VALUES (1,'admin','audit.probe','audit-probe-boundary',?)", [timestamp]);
      }
      await control.execute("INSERT INTO activity_logs (actor_id,actor_role,action,description,created_at) VALUES (1,'consumer','audit.probe','audit-probe-consumer','2026-01-01 00:00:00')");
      const audit = await request('/activity-logs?role=admin&date=2026-01-01&search=audit-probe');
      assert.equal(audit.status, 200, JSON.stringify(audit));
      assert.equal(audit.data.pagination.total, 12);
      assert.equal(audit.data.logs.length, 10);
      assert.equal(audit.data.logs[0].actor, 'test.admin');
      assert.equal(audit.data.logs[0].password_hash, undefined);
      assert.equal(audit.data.logs[0].timestamp, '2026-01-01T00:00:00Z');
      const auditNext = await request('/activity-logs?role=admin&date=2026-01-01&search=audit-probe&page=2');
      assert.equal(auditNext.data.logs.length, 2);
      assert.equal(new Set([...audit.data.logs,...auditNext.data.logs].map(log=>log.id)).size,12);
      const consumerAudit = await request('/activity-logs?role=consumer&date=2026-01-01&search=audit-probe');
      assert.equal(consumerAudit.data.pagination.total, 1);
      assert.equal((await request('/activity-logs?role=invalid')).status, 400);
      assert.equal((await request('/activity-logs?date=2026-02-30')).status, 400);
      assert.equal((await request('/activity-logs', 'GET', undefined, ownerToken)).status, 403);
      assert.equal((await request('/activity-logs', 'GET', undefined, '')).status, 401);
      const currentDashboardYear = Number(today.slice(0,4));
      const previousDashboardYear = currentDashboardYear - 1;
      await control.execute('UPDATE payments SET paid_at = ? WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM payments) first_payment)', [previousDashboardYear + '-06-15 00:00:00']);
      const yearlyDashboard = await request('/dashboard?year=' + previousDashboardYear);
      assert.equal(yearlyDashboard.status, 200, JSON.stringify(yearlyDashboard));
      assert.equal(yearlyDashboard.data.period.year, previousDashboardYear);
      assert.equal(yearlyDashboard.data.monthlyCollections.length, 12);
      assert.equal(Number(yearlyDashboard.data.monthlyCollections[5].amount), 4);
      assert.equal(yearlyDashboard.data.availableYears.includes(previousDashboardYear), true);
      assert.equal(yearlyDashboard.data.period.through, previousDashboardYear + '-12-31');
      const currentDashboard = await request('/dashboard');
      assert.equal(currentDashboard.data.period.year, currentDashboardYear);
      assert.equal(Number(currentDashboard.data.summary.monthCollections), Number(yearlyDashboard.data.summary.monthCollections));
      assert.equal((await request('/dashboard?year=' + (currentDashboardYear + 1))).status, 400);
      const unread=await request('/notifications/mine','GET',undefined,ownerToken);
      assert.ok(unread.data.some(item=>!item.read));
      const firstKey=unread.data[0].id;
      assert.equal((await request('/notifications/read','POST',{ids:[firstKey]},ownerToken)).status,200);
      const afterRead=await request('/notifications/mine','GET',undefined,ownerToken);
      assert.equal(afterRead.data.find(item=>item.id===firstKey).read,true);
      assert.equal((await request('/notifications/read','POST',{ids:[firstKey]},nextLogin.data.accessToken)).status,404);
      const exportSource = (await request('/customers/' + customer.id)).data.customer;
      const separateConnection = {...body, firstName:exportSource.firstName,contact:exportSource.contact,barangayId:exportSource.barangayId,address:exportSource.address,username:'separate.connection',meterNumber:'SEPARATE-METER'};
      assert.equal((await request('/customers/check-duplicate','POST',{...separateConnection,address:'Purok 7'})).data.exists,false);
      assert.equal((await request('/customers/check-duplicate','POST',{...separateConnection,barangayId:'999'})).data.exists,false);
      assert.equal((await request('/customers/check-duplicate','POST',separateConnection)).data.exists,true);
      assert.equal((await request('/customers','POST',separateConnection)).status,409);
      assert.equal((await request('/customers','POST',{...separateConnection,duplicateReviewed:'true'})).status,400);
      const reviewedConnection = await request('/customers','POST',{...separateConnection,duplicateReviewed:true});
      assert.equal(reviewedConnection.status,201,JSON.stringify(reviewedConnection));
      assert.equal((await request('/customers','POST',{...separateConnection,duplicateReviewed:true})).status,409);

      const restoreKeys = ['firstName','middleName','lastName','extensionName','gender','contact','address','street','customerType','natureOfWork','dateApplied','dateApproved','dateInstalled','meterNumber','meterKind','meterSize','initialReading','reading','certificateReceived','contractReceived','acknowledgementReceived','installationFee','setbackLength','setbackRate','reinstallationFee','violationFee'];
      const amountKeys = ['initialReading','reading','installationFee','setbackLength','setbackRate','reinstallationFee','violationFee'];
      for (const [index, serviceStatus] of ['Pending','Approved','Installed'].entries()) {
        const restoredInput = Object.fromEntries(restoreKeys.map(key=>[key, exportSource[key]]));
        Object.assign(restoredInput, {account:'RESTORE-' + index,submitterNumber:'SUB-RESTORE-' + index,applicationNumber:'APP-RESTORE-' + index,username:'restore@' + index,barangayId:'1',
          serviceStatus,connectionStatus:serviceStatus === 'Installed' ? 'Disconnected' : 'Inactive',
          dateApplied:'2025-01-01',dateApproved:serviceStatus === 'Pending' ? '' : '2025-01-02',
          dateInstalled:serviceStatus === 'Installed' ? '2025-01-03' : '',meterNumber:serviceStatus === 'Installed' ? 'MTR-RESTORE-001' : '',
          reading:serviceStatus === 'Installed' ? '12.345' : '0',initialReading:serviceStatus === 'Installed' ? '1.250' : '0',
          certificateReceived:true,contractReceived:false,acknowledgementReceived:true,
          installationFee:'123.45',setbackLength:'1.250',setbackRate:'9.99',reinstallationFee:'2.00',violationFee:'0.00'});
        const preview = await request('/customers/import/preview','POST',{customers:[restoredInput]});
        assert.equal(preview.status,200,JSON.stringify(preview));
        assert.equal(preview.data.count,1,JSON.stringify(preview));
        const saved = await request('/customers/import','POST',{customers:[restoredInput],reviewRevision:preview.data.revision});
        assert.equal(saved.status,201,JSON.stringify(saved));
        const restoredCustomer = (await request('/customers?search=' + restoredInput.account)).data.customers[0];
        for (const key of [...restoreKeys,'account','submitterNumber','applicationNumber','username','serviceStatus','connectionStatus']) {
          assert.equal(String(restoredCustomer[key]),String(amountKeys.includes(key) ? Number(restoredInput[key]) : restoredInput[key]),key);
        }
        const restoredLogin = await request('/auth/login','POST',{username:restoredInput.username,password:restoredInput.submitterNumber});
        assert.equal(restoredLogin.status,200,JSON.stringify(restoredLogin));
        assert.equal(restoredLogin.data.user.mustChangePassword,true);
        assert.equal((await request('/auth/logout','POST',{refreshToken:restoredLogin.data.refreshToken})).status,200);
        assert.equal((await request('/auth/refresh','POST',{refreshToken:restoredLogin.data.refreshToken})).status,401);
        assert.equal((await request('/auth/me','GET',undefined,restoredLogin.data.accessToken)).status,401);
        const duplicatePreview = await request('/customers/import/preview','POST',{customers:[restoredInput]});
        assert.equal(duplicatePreview.data.count,0);
        assert.equal(duplicatePreview.data.rejectedCount,1);
        assert.equal((await request('/customers/import','POST',{customers:[restoredInput]})).status,409);
        const reusedUsername = {...restoredInput,account:'OTHER-' + index,submitterNumber:'OTHER-SUB-' + index,applicationNumber:'OTHER-APP-' + index,meterNumber:restoredInput.meterNumber ? 'OTHER-METER-' + index : ''};
        const usernamePreview = await request('/customers/import/preview','POST',{customers:[reusedUsername]});
        assert.equal(usernamePreview.data.count,0);
        assert.match(usernamePreview.data.rows[0].reason,/username.*already registered/);

      }







      {
      const automaticInstall = {
        ...body, account: 'AUTO-INSTALLED-IMPORT', username: 'auto.installed.import',
        submitterNumber: 'TEMP-AUTO-IMPORT', serviceStatus: 'Approved', connectionStatus: 'Inactive',
        meterNumber: 'AUTO-INSTALLED-METER', dateApplied: today, dateApproved: today,
        dateInstalled: today, certificateReceived: true, contractReceived: true,
        acknowledgementReceived: true, barangayId: '1',
      };
      delete automaticInstall.password;
      const autoPreview = await request('/customers/import/preview', 'POST', { customers: [automaticInstall] });
      assert.equal(autoPreview.data.count, 1, JSON.stringify(autoPreview));
      const autoSaved = await request('/customers/import', 'POST', { customers: [automaticInstall], reviewRevision: autoPreview.data.revision });
      assert.equal(autoSaved.status, 201, JSON.stringify(autoSaved));
      const autoCustomer = (await request('/customers?search=AUTO-INSTALLED-IMPORT')).data.customers[0];
      assert.equal(autoCustomer.serviceStatus, 'Installed');
      assert.equal(autoCustomer.connectionStatus, 'Active');
      const autoLogin = await request('/auth/login', 'POST', { username: automaticInstall.username, password: automaticInstall.submitterNumber });
      assert.equal(autoLogin.status, 200, JSON.stringify(autoLogin));
      assert.equal(autoLogin.data.user.mustChangePassword, true);
      const autoEntries = await request('/meter-entries?setupId=' + setup.data.id);
      assert.equal(autoEntries.status, 200, JSON.stringify(autoEntries));
      assert.ok(autoEntries.data.customers.some((row) => row.id === autoCustomer.id));
      }
      // Delete a billed customer only after all preceding financial assertions.
      assert.equal((await request('/customers/' + customer.id, 'DELETE', undefined, '')).status, 401);
      assert.equal((await request('/customers/' + customer.id, 'DELETE', undefined, ownerToken)).status, 403);
      const beforeDelete = (await request('/customers/' + customer.id)).data.customer;
      await control.query(`CREATE TRIGGER reject_customer_delete_audit BEFORE INSERT ON activity_logs
        FOR EACH ROW BEGIN IF NEW.action = 'delete' AND NEW.entity_type = 'customer' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected delete audit failure'; END IF; END`);
      assert.equal((await request('/customers/' + customer.id, 'DELETE')).status, 500);
      assert.equal((await request('/customers/' + customer.id)).status, 200);
      const [[remainingBills]] = await control.execute('SELECT COUNT(*) AS total FROM bills WHERE customer_id=?', [customer.id]);
      assert.ok(Number(remainingBills.total) > 0);
      await control.query('DROP TRIGGER reject_customer_delete_audit');
      const deleted = await request('/customers/' + customer.id, 'DELETE');
      assert.equal(deleted.status, 200, JSON.stringify(deleted));
      assert.equal(deleted.data.count, 1);
      assert.equal((await request('/customers/' + customer.id)).status, 404);
      const [[deletedLogin]] = await control.execute('SELECT COUNT(*) AS total FROM users WHERE id=?', [beforeDelete.userId]);
      assert.equal(Number(deletedLogin.total), 0);
      assert.equal((await request('/auth/me', 'GET', undefined, ownerToken)).status, 401);
      const batchIds = [reviewedConnection.data.id];
      assert.equal((await request('/customers/delete-selected', 'POST', { ids: [...batchIds, '18446744073709551615'] })).status, 409);
      assert.equal((await request('/customers/' + batchIds[0])).status, 200);
      assert.equal((await request('/customers/delete-selected', 'POST', { ids: batchIds })).status, 200);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (pool) await pool.end();
      // Only the generated disposable database is ever removed.
      if (createdDatabase) await control.query('DROP DATABASE IF EXISTS `' + name + '`');
      await control.end();
    }
  },
);
