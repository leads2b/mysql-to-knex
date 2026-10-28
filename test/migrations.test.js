// Dependency-free tests for utils/migrations.js: run with `npm test`.
// Columns are fake information_schema.COLUMNS rows, so no database is needed.
const assert = require('assert');
const vm = require('vm');
const { generateTableMigration } = require('../utils/migrations.js');

const TABLE_INFO = 'CREATE TABLE `t` (\n) ENGINE=InnoDB';

const column = (fields) => Object.assign({
  TABLE_NAME: 't',
  COLUMN_NAME: 'c',
  COLUMN_DEFAULT: null,
  IS_NULLABLE: 'YES',
  CHARACTER_MAXIMUM_LENGTH: null,
  NUMERIC_PRECISION: null,
  NUMERIC_SCALE: null,
  DATETIME_PRECISION: null,
  COLUMN_KEY: '',
  EXTRA: '',
}, fields);

const generate = (columns, table_info = TABLE_INFO) => generateTableMigration(columns, 't', table_info);

const assertContains = (output, expected) => {
  assert.ok(output.includes(expected), `Expected output to contain:\n  ${expected}\nOutput:\n${output}`);
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('mediumint keeps its type, unsigned, default and nullable', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'mediumint', COLUMN_TYPE: 'mediumint(8)' }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'mediumint', COLUMN_TYPE: 'mediumint(8) unsigned', COLUMN_DEFAULT: '0', IS_NULLABLE: 'NO' }),
  ]);
  assertContains(output, "table.mediumint('a').nullable();");
  assertContains(output, "table.mediumint('b').unsigned().defaultTo('0').notNullable();");
});

test('mediumint auto-increment primary key keeps its type', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'id', DATA_TYPE: 'mediumint', COLUMN_TYPE: 'mediumint(8) unsigned', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI', EXTRA: 'auto_increment' }),
  ]);
  assertContains(output, "table.increments('id');");
  assertContains(output, ".raw('ALTER TABLE `t` MODIFY COLUMN `id` mediumint(8) unsigned NOT NULL AUTO_INCREMENT')");
});

test('smallint is not widened to integer', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'smallint', COLUMN_TYPE: 'smallint(6)' }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'smallint', COLUMN_TYPE: 'smallint(5) unsigned' }),
  ]);
  assertContains(output, "table.smallint('a').nullable();");
  assertContains(output, "table.smallint('b').unsigned().nullable();");
});

test('year and set keep their exact type', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'year', COLUMN_TYPE: 'year(4)' }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'set', COLUMN_TYPE: "set('a','b')", COLUMN_DEFAULT: 'a,b', IS_NULLABLE: 'NO' }),
  ]);
  assertContains(output, `table.specificType('a', "year(4)").nullable();`);
  assertContains(output, `table.specificType('b', "set('a','b')").defaultTo('a,b').notNullable();`);
});

test('bit uses its length and a raw bit literal default', async () => {
  const output = await generate([
    column({ DATA_TYPE: 'bit', COLUMN_TYPE: 'bit(1)', NUMERIC_PRECISION: 1, COLUMN_DEFAULT: "b'0'", IS_NULLABLE: 'NO' }),
  ]);
  assertContains(output, `table.bit('c', 1).defaultTo(knex.raw("b'0'")).notNullable();`);
  assert.doesNotThrow(() => new vm.Script(output));
});

test('varbinary and binary keep their length', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'varbinary', COLUMN_TYPE: 'varbinary(16)', CHARACTER_MAXIMUM_LENGTH: 16 }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'binary', COLUMN_TYPE: 'binary(16)', CHARACTER_MAXIMUM_LENGTH: 16 }),
  ]);
  assertContains(output, "table.binary('a', 16).nullable();");
  assertContains(output, "table.binary('b', 16).nullable();");
  assertContains(output, ".raw('ALTER TABLE `t` MODIFY COLUMN `b` binary(16) DEFAULT NULL')");
});

test('tinytext and blob variants keep their exact type', async () => {
  const output = await generate(['tinytext', 'tinyblob', 'mediumblob', 'longblob'].map((type) => (
    column({ COLUMN_NAME: type, DATA_TYPE: type, COLUMN_TYPE: type })
  )));
  ['tinytext', 'tinyblob', 'mediumblob', 'longblob'].forEach((type) => {
    assertContains(output, `table.specificType('${type}', "${type}").nullable();`);
  });
});

test('spatial types keep their type and SRID', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'point', COLUMN_TYPE: 'point', IS_NULLABLE: 'NO', SRS_ID: 4326 }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'geometrycollection', COLUMN_TYPE: 'geometrycollection' }),
  ]);
  assertContains(output, `table.specificType('a', "point SRID 4326").notNullable();`);
  assertContains(output, `table.specificType('b', "geometrycollection").nullable();`);
});

test('ON UPDATE CURRENT_TIMESTAMP and DEFAULT_GENERATED columns are kept', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'timestamp', COLUMN_TYPE: 'timestamp', COLUMN_DEFAULT: 'CURRENT_TIMESTAMP', IS_NULLABLE: 'NO', EXTRA: 'on update CURRENT_TIMESTAMP', DATETIME_PRECISION: 0 }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'timestamp', COLUMN_TYPE: 'timestamp', COLUMN_DEFAULT: 'CURRENT_TIMESTAMP', IS_NULLABLE: 'NO', EXTRA: 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP', DATETIME_PRECISION: 0 }),
    column({ COLUMN_NAME: 'c', DATA_TYPE: 'timestamp', COLUMN_TYPE: 'timestamp', EXTRA: 'on update CURRENT_TIMESTAMP', DATETIME_PRECISION: 0 }),
    column({ COLUMN_NAME: 'd', DATA_TYPE: 'datetime', COLUMN_TYPE: 'datetime', COLUMN_DEFAULT: 'CURRENT_TIMESTAMP', IS_NULLABLE: 'NO', EXTRA: 'DEFAULT_GENERATED', DATETIME_PRECISION: 0 }),
  ]);
  assertContains(output, `table.timestamp('a').defaultTo(knex.raw("CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP")).notNullable();`);
  assertContains(output, `table.timestamp('b').defaultTo(knex.raw("CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP")).notNullable();`);
  assertContains(output, `table.timestamp('c').defaultTo(knex.raw("NULL on update CURRENT_TIMESTAMP")).nullable();`);
  assertContains(output, "table.datetime('d').defaultTo(knex.fn.now()).notNullable();");
  assert.doesNotThrow(() => new vm.Script(output));
});

test('temporal columns keep their fractional seconds precision', async () => {
  const output = await generate([
    column({ COLUMN_NAME: 'a', DATA_TYPE: 'datetime', COLUMN_TYPE: 'datetime(3)', DATETIME_PRECISION: 3 }),
    column({ COLUMN_NAME: 'b', DATA_TYPE: 'timestamp', COLUMN_TYPE: 'timestamp(6)', COLUMN_DEFAULT: 'CURRENT_TIMESTAMP(6)', IS_NULLABLE: 'NO', EXTRA: 'DEFAULT_GENERATED', DATETIME_PRECISION: 6 }),
    column({ COLUMN_NAME: 'd', DATA_TYPE: 'time', COLUMN_TYPE: 'time(2)', DATETIME_PRECISION: 2 }),
    column({ COLUMN_NAME: 'e', DATA_TYPE: 'timestamp', COLUMN_TYPE: 'timestamp(3)', COLUMN_DEFAULT: 'CURRENT_TIMESTAMP(3)', IS_NULLABLE: 'NO', EXTRA: 'DEFAULT_GENERATED on update CURRENT_TIMESTAMP(3)', DATETIME_PRECISION: 3 }),
  ]);
  assertContains(output, "table.datetime('a', { precision: 3 }).nullable();");
  assertContains(output, `table.timestamp('b', { precision: 6 }).defaultTo(knex.raw("CURRENT_TIMESTAMP(6)")).notNullable();`);
  assertContains(output, "table.time('d', { precision: 2 }).nullable();");
  assertContains(output, `table.timestamp('e', { precision: 3 }).defaultTo(knex.raw("CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3)")).notNullable();`);
});

test('unknown types produce a warning instead of being dropped silently', async () => {
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(message);
  let output;
  try {
    output = await generate([column({ COLUMN_NAME: 'v', DATA_TYPE: 'vector', COLUMN_TYPE: 'vector(3)' })]);
  } finally {
    console.warn = warn;
  }
  assert.ok(!output.includes("'v'"), `Expected no line for column v:\n${output}`);
  assert.strictEqual(warnings.length, 1);
  assertContains(warnings[0], 't.v');
  assertContains(warnings[0], 'vector(3)');
});

test('regression: previously supported types keep their output', async () => {
  const table_info = 'CREATE TABLE `t` (\n'
    + '  `g` int(11) GENERATED ALWAYS AS ((`i` + 1)) VIRTUAL,\n'
    + ') ENGINE=InnoDB';
  const output = await generate([
    column({ COLUMN_NAME: 'id', DATA_TYPE: 'int', COLUMN_TYPE: 'int(10) unsigned', IS_NULLABLE: 'NO', COLUMN_KEY: 'PRI', EXTRA: 'auto_increment' }),
    column({ COLUMN_NAME: 'ti', DATA_TYPE: 'tinyint', COLUMN_TYPE: 'tinyint(1)', COLUMN_DEFAULT: '0', IS_NULLABLE: 'NO' }),
    column({ COLUMN_NAME: 'i', DATA_TYPE: 'int', COLUMN_TYPE: 'int(11)' }),
    column({ COLUMN_NAME: 'bi', DATA_TYPE: 'bigint', COLUMN_TYPE: 'bigint(20) unsigned' }),
    column({ COLUMN_NAME: 'vc', DATA_TYPE: 'varchar', COLUMN_TYPE: 'varchar(255)', CHARACTER_MAXIMUM_LENGTH: 255 }),
    column({ COLUMN_NAME: 'ch', DATA_TYPE: 'char', COLUMN_TYPE: 'char(2)', CHARACTER_MAXIMUM_LENGTH: 2, CHARACTER_SET_NAME: 'utf8' }),
    column({ COLUMN_NAME: 'en', DATA_TYPE: 'enum', COLUMN_TYPE: "enum('x','y')", COLUMN_DEFAULT: 'x', IS_NULLABLE: 'NO' }),
    column({ COLUMN_NAME: 'de', DATA_TYPE: 'decimal', COLUMN_TYPE: 'decimal(10,2)', NUMERIC_PRECISION: 10, NUMERIC_SCALE: 2 }),
    column({ COLUMN_NAME: 'dt', DATA_TYPE: 'datetime', COLUMN_TYPE: 'datetime', DATETIME_PRECISION: 0 }),
    column({ COLUMN_NAME: 'g', DATA_TYPE: 'int', COLUMN_TYPE: 'int(11)', EXTRA: 'VIRTUAL GENERATED' }),
  ], table_info);
  assertContains(output, "table.increments('id');");
  assert.ok(!output.includes('MODIFY COLUMN `id`'), `Expected no fix-up for an int(10) unsigned auto-increment:\n${output}`);
  assertContains(output, "table.tinyint('ti', 1).defaultTo('0').notNullable();");
  assertContains(output, "table.integer('i', 11).nullable();");
  assertContains(output, "table.bigint('bi').unsigned().nullable();");
  assertContains(output, "table.string('vc', 255).nullable();");
  assertContains(output, "table.string('ch', '2').nullable();");
  assertContains(output, ".raw('ALTER TABLE `t` MODIFY COLUMN `ch` char(2) CHARACTER SET utf8 DEFAULT NULL')");
  assertContains(output, "table.enu('en', ['x','y']).defaultTo('x').notNullable();");
  assertContains(output, "table.decimal('de', 10, 2).nullable();");
  assertContains(output, "table.datetime('dt').nullable();");
  assert.ok(!output.includes("'g'"), `Expected no builder line for the generated column:\n${output}`);
  assertContains(output, '.raw("ALTER TABLE `t` ADD COLUMN `g` int(11) GENERATED ALWAYS AS ((`i` + 1)) VIRTUAL")');
  assert.doesNotThrow(() => new vm.Script(output));
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (err) {
      failed++;
      console.log(`not ok - ${name}\n${err.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
