import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePhpMyAdminImport } from '../src/database/phpmyadmin-import.js';

test('moves composite primary keys before inserts and preserves indexes and data', () => {
  const sql = "CREATE TABLE `links` (\n  `a` int NOT NULL,\n  `b` int NOT NULL\n) ENGINE=InnoDB;\nINSERT INTO `links` VALUES (1,2);\nALTER TABLE `links`\n  ADD PRIMARY KEY (`a`,`b`),\n  ADD KEY `other` (`b`);";
  const result = preparePhpMyAdminImport(sql);
  assert.match(result, /`b` int NOT NULL,\n  PRIMARY KEY \(`a`,`b`\)\n\) ENGINE/);
  assert.match(result, /INSERT INTO `links` VALUES \(1,2\);/);
  assert.match(result, /ALTER TABLE `links`\s+ADD KEY `other`/);
  assert.doesNotMatch(result, /ADD PRIMARY KEY/);
});

test('removes primary-key-only ALTER statements and refuses missing keys', () => {
  const create = 'CREATE TABLE `logs` (\n  `id` int NOT NULL\n) ENGINE=InnoDB;';
  assert.throws(() => preparePhpMyAdminImport(create), /No primary key/);
  const result = preparePhpMyAdminImport(create + '\nALTER TABLE `logs`\n  ADD PRIMARY KEY (`id`);');
  assert.doesNotMatch(result, /ALTER TABLE/);
  assert.match(result, /PRIMARY KEY \(`id`\)/);
});
