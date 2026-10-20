// Baseline inspection for the initial CREATE TABLE migrations only.
// This is deliberately not a general SQL parser. Unknown definitions fail closed.
export function splitDefinitions(sql) {
  const parts = [];
  let quote = false;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    if (char === "'" && sql[index - 1] !== '\\') {
      if (quote && sql[index + 1] === "'") {
        index++;
        continue;
      }
      quote = !quote;
    }
    if (quote) continue;
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(sql.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(sql.slice(start).trim());
  return parts;
}

export function normalizeType(value) {
  return value
    .toLowerCase()
    .replace(/\b(bigint|int|tinyint)\(\d+\)/g, '$1')
    .replace(/,\s+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function expression(value) {
  return (value || '').toLowerCase().replace(/[`\s()]/g, '');
}

function defaultValue(value) {
  if (value == null || /^null$/i.test(String(value))) return null;
  const text = String(value).replace(/^'(.*)'$/s, '$1');
  if (/^current_timestamp(?:\(\))?$/i.test(text)) return 'CURRENT_TIMESTAMP';
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text).toString();
  return text;
}

const columnList = (value) => value.split(',').map((name) => name.trim());

export function initialTables(files) {
  const tables = [];
  for (const file of files) {
    for (const match of file.sql.matchAll(
      /CREATE TABLE (\w+)\s*\(([\s\S]*?)\) ENGINE\s*=\s*InnoDB;/g,
    )) {
      const table = { name: match[1], columns: [], indexes: [], foreignKeys: [], checks: [] };
      for (const definition of splitDefinitions(match[2])) {
        let item;
        if ((item = /^PRIMARY KEY \(([^)]+)\)$/.exec(definition))) {
          table.indexes.push({ name: 'PRIMARY', unique: true, columns: columnList(item[1]) });
        } else if ((item = /^(UNIQUE )?KEY (\w+) \(([^)]+)\)$/.exec(definition))) {
          table.indexes.push({
            name: item[2],
            unique: Boolean(item[1]),
            columns: columnList(item[3]),
          });
        } else if (
          (item =
            /^CONSTRAINT (\w+) FOREIGN KEY \((\w+)\)\s+REFERENCES (\w+) \((\w+)\) ON DELETE RESTRICT ON UPDATE RESTRICT$/.exec(
              definition,
            ))
        ) {
          table.foreignKeys.push({
            name: item[1],
            column: item[2],
            table: item[3],
            referencedColumn: item[4],
          });
        } else if ((item = /^CONSTRAINT (\w+) CHECK \(([^)]+)\)$/.exec(definition))) {
          table.checks.push({ name: item[1], expression: expression(item[2]) });
        } else if (
          (item =
            /^(\w+) ((?:BIGINT|TINYINT\(1\)|TINYINT|VARCHAR\(\d+\)|DECIMAL\(\d+,\s*\d+\)|ENUM\([^)]*\)|DATETIME|TIMESTAMP|DATE|TEXT)(?: UNSIGNED)?)([\s\S]*)$/.exec(
              definition,
            ))
        ) {
          const rest = item[3];
          table.columns.push({
            name: item[1],
            type: normalizeType(item[2]),
            nullable: !/NOT NULL/.test(rest),
            default: defaultValue(/DEFAULT ('[^']*'|\w+(?:\(\))?)/.exec(rest)?.[1]),
            autoIncrement: /AUTO_INCREMENT/.test(rest),
            onUpdate: /ON UPDATE CURRENT_TIMESTAMP/.test(rest),
            generated: expression(/GENERATED ALWAYS AS \(([^)]+)\) STORED/.exec(rest)?.[1]),
          });
        } else throw new Error('Unsupported baseline definition: ' + definition);
      }
      tables.push(table);
    }
  }
  if (tables.length !== 18)
    throw new Error('The initial baseline must describe exactly 18 tables.');
  return tables;
}

export async function inspectBaseline(connection, files) {
  const tables = initialTables(files);
  const differences = [];
  for (const table of tables) {
    const [metadata] = await connection.execute(
      'SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [table.name],
    );
    if (!metadata.length) {
      differences.push(table.name + ': missing table');
      continue;
    }
    if (metadata[0].ENGINE !== 'InnoDB' || !metadata[0].TABLE_COLLATION?.startsWith('utf8mb4_')) {
      differences.push(table.name + ': expected InnoDB and utf8mb4');
    }
    const [columns] = await connection.execute(
      'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      [table.name],
    );
    if (columns.length !== table.columns.length)
      differences.push(table.name + ': column count differs');
    for (const expected of table.columns) {
      const actual = columns.find((column) => column.COLUMN_NAME === expected.name);
      if (
        !actual ||
        normalizeType(actual.COLUMN_TYPE) !== expected.type ||
        (actual.IS_NULLABLE === 'YES') !== expected.nullable ||
        defaultValue(actual.COLUMN_DEFAULT) !== expected.default ||
        /auto_increment/i.test(actual.EXTRA) !== expected.autoIncrement ||
        /on update current_timestamp/i.test(actual.EXTRA) !== expected.onUpdate ||
        expression(actual.GENERATION_EXPRESSION) !== expected.generated ||
        (expected.generated && !/stored generated/i.test(actual.EXTRA))
      ) {
        differences.push(table.name + '.' + expected.name + ': column definition differs');
      }
    }
    const [indexes] = await connection.execute(
      'SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX, SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX',
      [table.name],
    );
    for (const expected of table.indexes) {
      const actual = indexes.filter((index) => index.INDEX_NAME === expected.name);
      if (
        actual.length !== expected.columns.length ||
        actual.some(
          (index, position) =>
            index.COLUMN_NAME !== expected.columns[position] ||
            Number(index.NON_UNIQUE) !== (expected.unique ? 0 : 1) ||
            index.SUB_PART != null,
        )
      ) {
        differences.push(table.name + ': missing or different index ' + expected.name);
      }
    }
    const [foreignKeys] = await connection.execute(
      `SELECT k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
        r.DELETE_RULE, r.UPDATE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME
         AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL`,
      [table.name],
    );
    if (foreignKeys.length !== table.foreignKeys.length)
      differences.push(table.name + ': foreign key count differs');
    for (const expected of table.foreignKeys) {
      if (
        !foreignKeys.some(
          (key) =>
            key.CONSTRAINT_NAME === expected.name &&
            key.COLUMN_NAME === expected.column &&
            key.REFERENCED_TABLE_NAME === expected.table &&
            key.REFERENCED_COLUMN_NAME === expected.referencedColumn &&
            ['RESTRICT', 'NO ACTION'].includes(key.DELETE_RULE) &&
            ['RESTRICT', 'NO ACTION'].includes(key.UPDATE_RULE),
        )
      ) {
        differences.push(table.name + ': missing or different foreign key ' + expected.name);
      }
    }
    if (table.checks.length) {
      const [checks] = await connection.execute(
        'SELECT CONSTRAINT_NAME, CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?',
        [table.checks[0].name],
      );
      for (const expected of table.checks) {
        if (
          !checks.some(
            (check) =>
              check.CONSTRAINT_NAME === expected.name &&
              expression(check.CHECK_CLAUSE) === expected.expression,
          )
        ) {
          differences.push(table.name + ': missing or different check ' + expected.name);
        }
      }
    }
  }
  if (differences.length)
    throw new Error('Baseline refused. No history was recorded:\n' + differences.join('\n'));
  return tables.length;
}
