// phpMyAdmin exports primary keys in later ALTER statements. Managed MySQL
// requires those keys when each table is first created. Keep all other SQL intact.
export function preparePhpMyAdminImport(sql) {
  const keys = new Map();
  let prepared = sql.replace(
    /^ALTER TABLE `([^`]+)`\s+ADD PRIMARY KEY (\([^;\r\n]+\))([,;])/gm,
    (statement, table, columns, ending) => {
      if (keys.has(table)) throw new Error('Duplicate primary key declaration: ' + table);
      keys.set(table, columns);
      return ending === ',' ? 'ALTER TABLE `' + table + '`\n ' : '';
    },
  );
  prepared = prepared.replace(
    /^(CREATE TABLE `([^`]+)` \([\s\S]*?)^\)([^\r\n;]*;)/gm,
    (statement, definition, table, options) => {
      const columns = keys.get(table);
      if (!columns) {
        if (!/^\s*PRIMARY KEY\s*\(/m.test(definition)) {
          throw new Error('No primary key found for table: ' + table);
        }
        return statement;
      }
      keys.delete(table);
      return definition.trimEnd() + ',\n  PRIMARY KEY ' + columns + '\n)' + options;
    },
  );
  if (keys.size) throw new Error('Could not match CREATE TABLE for: ' + [...keys.keys()].join(', '));
  return prepared;
}
