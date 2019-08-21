String.prototype.addEndLine = function() {
  return `${this.valueOf()}\n`;
}

String.prototype.addCaracters = function(caracteres = '') {
  return `${this.valueOf()}${caracteres}`;
};

const addClosing = (knex_data = '') => {
  knex_data = knex_data
    .addEndLine()
    .addCaracters('}');
  return knex_data;
}

const addTopConstructor = (table_name, structure_type, knex_data = '') => {
  knex_data = knex_data
    .addCaracters('exports.up = function(knex, Promise) {')
    .addEndLine()
    .addCaracters('  ')

  if (structure_type === 'table') {
    knex_data = knex_data
      .addCaracters(`return knex.schema.createTable('${table_name}', (table) => {`)
      .addEndLine();
  } else if (structure_type === 'view') {
    knex_data = knex_data
      .addCaracters(`return knex.raw("CREATE OR REPLACE VIEW `);
  }

  return knex_data;
}

const addBottomConstructor = (table_view_name, structure_type, knex_data = '') => {
  knex_data = addClosing();
    knex_data = knex_data
      .addEndLine()
      .addEndLine()
      .addCaracters('exports.down = function(knex, Promise) {')
      .addEndLine()
      .addCaracters('  ');

  if (structure_type === 'table') {
    knex_data = knex_data
      .addCaracters(`return knex.schema.dropTable('${table_view_name}');`);

  } else if (structure_type === 'view') {
    knex_data = knex_data
      .addCaracters(`return knex.raw("DROP VIEW ${table_view_name}");`);
  }

  knex_data = knex_data
    .addEndLine()
    .addCaracters('}')
    .addEndLine();

  return knex_data;
}

/**
 * Return default and nullable options for the given column
 *
 * @param {string} column_default
 * @param {string} is_nullable
 * @param {string} [knex_data = '']
 * @returns {string} knex_data
 */
const checkDefaultAndNullable = (column_default, is_nullable, knex_data = '') => {
  if (column_default !== null) {
    if (column_default === 'CURRENT_TIMESTAMP') {
      knex_data += `.defaultTo(knex.fn.now())`;
    } else {
      knex_data += `.defaultTo('${column_default}')`;
    }
  }
  if (is_nullable) {
    knex_data += is_nullable === 'YES' ? '.nullable()' : '.notNullable()';
  }
  return knex_data;
}

const isUnsigned = (column_data) => {
  const unsignableTypes = [
    'tinyint',
    'smallint',
    'mediumint',
    'int',
    'integer',
    'bigint',
    'real',
    'double',
    'float',
    'decimal',
    'numeric',
  ];

  if (unsignableTypes.includes(column_data.DATA_TYPE)) {
    const regex = new RegExp(`${column_data.DATA_TYPE}\\([0-9]*\\)(.*)`);
    let match = column_data.COLUMN_TYPE.replace(regex, '$1');

    match = match.split(' ').map(m => m.trim());
    if (match.includes('unsigned')) {
      return true;
    }
  }
  return false;
}

/**
 * Fill the knex_data for regular types with the given params
 *
 * @param {string} str_data
 * @param {boolean|string} [column_default = false]
 * @param {boolean|string} [is_nullable = false]
 * @param {string} [knex_data = '']
 * @returns {string} knex_data
 */
const fillRegularDataTypes = (str_data, column = null, knex_data = '') => {
  knex_data = knex_data.addCaracters('  ')
    .addCaracters('  ')
    .addCaracters(str_data);

  if (column) {
    if (isUnsigned(column)) {
      knex_data += '.unsigned()';
    }

    if (column.COLUMN_DEFAULT !== undefined || column.IS_NULLABLE !== undefined) {
      knex_data += checkDefaultAndNullable(column.COLUMN_DEFAULT, column.IS_NULLABLE);
    }
  }

  knex_data = knex_data
    .addCaracters(';')
    .addEndLine();
  return knex_data;
}

/**
 * Fill the knex_data for indexes with the given params
 *
 * @param {string} str_data
 * @param {string} [knex_data = '']
 * @returns {string} knex_data
 */
const fillIndexData = (str_data,  knex_data = '') => {
  knex_data = knex_data.addCaracters('  ')
    .addCaracters('  ')
    .addCaracters(str_data)
    .addCaracters(';')
    .addEndLine();
  return knex_data;
}

/**
 * Map the regular types of data for the given column
 *
 * @param {string} column
 * @param {string} [knex_data = '']
 * @returns {string} knex_data
 */
const mapTypes = (column, knex_data = '') => {
  if (column.EXTRA) {
    if (column.EXTRA === 'VIRTUAL GENERATED') {
      return knex_data;
    }
    // auto_increment
    if (column.EXTRA === 'auto_increment') {
      knex_data += fillRegularDataTypes(`table.increments('${column.COLUMN_NAME}')`);
    }
  } else {
    switch (column.DATA_TYPE) {
      case 'varchar':
        knex_data += fillRegularDataTypes(`table.string('${column.COLUMN_NAME}', ${column.CHARACTER_MAXIMUM_LENGTH})`, column);
      break;
      case 'bigint':
        knex_data += fillRegularDataTypes(`table.bigint('${column.COLUMN_NAME}')`, column);
      break;
      case 'longtext':
        knex_data += fillRegularDataTypes(`table.text('${column.COLUMN_NAME}', 'longtext')`, column);
      break;
      case 'datetime':
        knex_data += fillRegularDataTypes(`table.datetime('${column.COLUMN_NAME}')`, column);
      break;
      case 'int':
        knex_data += fillRegularDataTypes(`table.integer('${column.COLUMN_NAME}', ${column.COLUMN_TYPE.replace(/.*\(([0-9]+)\).*/gi, '$1').replace(/,/, '.')})`,
          column);
      break;
      case 'tinyint':
        knex_data += fillRegularDataTypes(`table.tinyint('${column.COLUMN_NAME}', ${column.COLUMN_TYPE.replace(/.*\(([0-9]+)\).*/gi, '$1').replace(/,/, '.')})`,
          column);
      break;
      case 'decimal':
        const decimal_column = `table.decimal('${column.COLUMN_NAME}', ${column.NUMERIC_PRECISION}, ${column.NUMERIC_SCALE})`;
        knex_data += fillRegularDataTypes(decimal_column, column);
      break;
      case 'double':
        const double_column = `table.double('${column.COLUMN_NAME}', ${column.NUMERIC_PRECISION}, ${column.NUMERIC_SCALE})`;
        knex_data += fillRegularDataTypes(double_column, column);
      break;
      case 'text':
        knex_data += fillRegularDataTypes(`table.text('${column.COLUMN_NAME}')`, column);
      break;
      case 'json':
        knex_data += fillRegularDataTypes(`table.json('${column.COLUMN_NAME}')`, column);
      break;
      case 'float':
        const float_column = `table.float('${column.COLUMN_NAME}', ${column.NUMERIC_PRECISION}, ${column.NUMERIC_SCALE})`;
        knex_data += fillRegularDataTypes(float_column, column);
      break;
      case 'mediumtext':
        knex_data += fillRegularDataTypes(`table.text('${column.COLUMN_NAME}', 'mediumtext')`, column);
      break;
      case 'enum':
        knex_data += fillRegularDataTypes(`table.enu('${column.COLUMN_NAME}', [${column.COLUMN_TYPE.replace(/enum\((.*)\)/, '$1')}])`,
          column);
      break;
      case 'char':
        knex_data += fillRegularDataTypes(`table.string('${column.COLUMN_NAME}', '${column.CHARACTER_MAXIMUM_LENGTH}')`, column);
      break;
      case 'blob':
        // The binary column with no argument is converted to blob at knex
        knex_data += fillRegularDataTypes(`table.binary('${column.COLUMN_NAME}')`, column);
      break;
      case 'binary':
        knex_data += fillRegularDataTypes(`table.binary('${column.COLUMN_NAME}', 1)`, column);
      break;
      case 'date':
        knex_data += fillRegularDataTypes(`table.date('${column.COLUMN_NAME}')`, column);
      break;
      case 'time':
        knex_data += fillRegularDataTypes(`table.time('${column.COLUMN_NAME}')`, column);
      break;
      case 'timestamp':
        knex_data += fillRegularDataTypes(`table.timestamp('${column.COLUMN_NAME}')`, column);
      break;
      case 'smallint':
        // There is no support for smallint in Knex, setting as integer
        knex_data += fillRegularDataTypes(`table.integer('${column.COLUMN_NAME}', ${column.COLUMN_TYPE.replace(/.*\(([0-9]+)\).*/gi, '$1').replace(/,/, '.')})`, column);
      break;
    }
  }

  return knex_data;
}

/**
 * Map the indexes for the given column
 *
 * @param {string} table_definition
 * @param {object} column
 * @param {boolean} contains_pK
 * @param {string} [knex_data = '']
 * @returns {string} knex_data
 */
const mapKeys = (column, contains_pK, knex_data = '') => {
  knex_data = mapTypes(column, knex_data);
  if (!column.EXTRA) {
    // Primary key
    if (column.COLUMN_KEY === 'PRI') {
      if (!contains_pK) {
        // One primary key
        knex_data += fillIndexData(`table.primary('${column.COLUMN_NAME}');`);
      } else {
        // Multiple primary keys
        let keys = knex_data.match(/.*table\.primary\(\[(.*)\]\);.*/gim);
        // It already has more than one key
        if (keys) {
          knex_data = knex_data.replace(/table\.primary\(\[(.*)\]\);/gim, `table.primary([$1, '${column.COLUMN_NAME}'])`);
        } else{
          knex_data = knex_data.replace(/table\.primary\((.*)\);/gim, `table.primary([$1, '${column.COLUMN_NAME}'])`);
        }
      }
    }
  }
  return knex_data;
}

/**
 * Generate instructions to add auto generated columns
 *
 * @param {string} column
 * @param {string} table_info
 * @param {string} table_name
 * @returns {string} knex_data
 */
const mapAutoGeneratedColumns = (column, table_info, table_name, knex_data_raw = '') => {
  const re_column = new RegExp(`\`${column.COLUMN_NAME}\`.*GENERATED.*,`, 'gim');
  const column_match = table_info.match(re_column);

  if (column_match) {

    const re_generated = new RegExp('.*GENERATED.*');
    const match_generated = column_match.toString().match(re_generated);
    if (match_generated) {
      const column_type = match_generated.toString().replace(new RegExp(`\`${column.COLUMN_NAME}\`\\s(.*)\\sGENERATED.*`, 'gim'), '$1');

      let column_desc = match_generated.toString().replace(new RegExp(`\`${column.COLUMN_NAME}\`.*GENERATED\\s`, 'gim'), '');
      column_desc = column_desc.substring(0, column_desc.length - 1); // Removes the comma in the end of string
      column_desc = column_desc.replace(/\"/gim, '\\"'); // Escape double quotes

      knex_data_raw = knex_data_raw.addCaracters('  ');
      knex_data_raw += `.raw("ALTER TABLE \`${table_name}\` ADD COLUMN \`${column.COLUMN_NAME}\` ${column_type} GENERATED ${column_desc}")`;
    }
  }
  return knex_data_raw;
}

/**
 * Handle foreign keys
 *
 * @param {string} constraint_match
 * @param {string} table_name
 */
const handleKFs = (constraint_match, table_name) => {
  let knex_data_raw = '';

  const re_constraint = new RegExp(`CONSTRAINT \`(.*)\` FOREIGN KEY \(\`?(.*)\`?\) REFERENCES \`(.*)\` \(\`?([^ ]*)\`?\)([^,|^\n]*)[,|\n]`, 'gim');
  const constraints = constraint_match.map((match) => {
    strMatch = match.toString();
    return {
      name: strMatch.replace(re_constraint, '$1').toString().replace(/\`|\(|\)|,|\n/gi, ''),
      column: strMatch.replace(re_constraint, '$2').toString().replace(/\`|\(|\)|,|\n/gi, ''),
      ref_table: strMatch.replace(re_constraint, '$4').toString().replace(/\`|\(|\)|,|\n/gi, ''),
      ref_column: strMatch.replace(re_constraint, '$5').toString().replace(/\`|\(|\)|,|\n/gi, ''),
      extra: strMatch.replace(re_constraint, '$7').toString().replace(/\`|\(|\)|,|\n/gi, ''),
    };
  });

  // Adding exports.up
  knex_data_raw = knex_data_raw
    .addCaracters('exports.up = function(knex, Promise) {');

  constraints.forEach((constraint, idx) => {
    knex_data_raw = knex_data_raw.addCaracters('\n  ');
    if (idx === 0) {
      knex_data_raw = knex_data_raw.addCaracters('return knex.schema');
    } else {
      knex_data_raw = knex_data_raw.addCaracters('  ');
    }

    knex_data_raw += `.raw("ALTER TABLE \`${table_name}\` ADD CONSTRAINT \`${constraint.name}\` FOREIGN KEY(\`${constraint.column}\`) REFERENCES \`${constraint.ref_table}\`(\`${constraint.ref_column}\`)${constraint.extra}")`;
  });

  knex_data_raw = knex_data_raw
    .addEndLine()
    .addCaracters('}')
    .addEndLine();


  // Adding exports.down
  knex_data_raw = knex_data_raw
    .addCaracters('exports.down = function(knex, Promise) {');

  constraints.forEach((constraint, idx) => {
    knex_data_raw = knex_data_raw.addCaracters('\n  ');
    if (idx === 0) {
      knex_data_raw = knex_data_raw.addCaracters('return knex.schema');
    } else {
      knex_data_raw = knex_data_raw.addCaracters('  ');
    }

    knex_data_raw += `.raw("ALTER TABLE \`${table_name}\` DROP FOREIGN KEY \`${constraint.name}\`")`;
  });
  knex_data_raw = knex_data_raw.addEndLine().addCaracters('}');

  return knex_data_raw;
}


/**
 * Extract indexes from the table creation definition
 *
 * @param {string} table_creation
 * @returns {array} array of table indexes
 */
const extractIndexesFromTableCreation = function(table_creation) {
  index_regex = /([\w]*) *(KEY|INDEX) ([^(]*) \(([^\)]*)\),?/g;

  const indexes = [];
  do {
    // This method will return the matching groups of the regex
    found_index = index_regex.exec(table_creation);
    if (!found_index) {
      continue;
    }

    const index_type = found_index[1].replace(/`/g, '').trim();

    // Removing ` character from table name
    const name = found_index[3].replace(/`/g, '').trim();

    // Removing ` character from columns
    const columns = found_index[4].replace(/`/g, '').trim().split(',');

    indexes.push({ type: index_type, name, columns });
  } while(found_index);

  return indexes;
}

/**
 * Generate table indexes' knex methods
 *
 * @param {string} knex_data
 * @param {string} table_creation
 * @returns {string} knex_data
 */
const mapIndexes = function(table_creation) {
  const raw_indexes = extractIndexesFromTableCreation(table_creation);

  let indexes_data = '';
  raw_indexes.forEach((index) => {
    let columnsStr;
    if (index.columns.length > 1) {
      columnsStr = JSON.stringify(index.columns).replace(/"/g, "'"); // ['a', 'b', 'c']
    } else {
      columnsStr = `'${index.columns[0]}'`; // 'a'
    }

    indexes_data += fillIndexData(`table.index(${columnsStr}, '${index.name}'${index.type ? `, '${index.type}'` : ''})`);
  });

  return indexes_data;
}

const insertIndexes = function(knex_data, table_name, indexes_data) {
  knex_data += `\n  .alterTable('${table_name}', (table) => {\n`;
  knex_data += indexes_data;
  knex_data += '  })';
  return knex_data;
}

const adjustCharColumns = function(knex_data, table_name, columns) {
  columns.forEach((column) => {
    let query = `ALTER TABLE \`${table_name}\` `;
    query += `MODIFY COLUMN \`${column.COLUMN_NAME}\` `;
    query += `char(${column.CHARACTER_MAXIMUM_LENGTH}) `;
    query += `CHARACTER SET ${column.CHARACTER_SET_NAME} `;
    if (column.IS_NULLABLE === 'YES') {
      query += 'DEFAULT NULL';
    } else if (column.COLUMN_DEFAULT) {
      query += 'NOT NULL';
      if (column.COLUMN_DEFAULT) {
        query += ` DEFAULT '${column.COLUMN_DEFAULT}'`;
      }
    }

    knex_data += `\n  .raw('${query}')`;
  });
  return knex_data;
}

const adjustBinaryColumns = function(knex_data, table_name, columns) {
  columns.forEach((column) => {
    let query = `ALTER TABLE \`${table_name}\` `;
    query += `MODIFY COLUMN \`${column.COLUMN_NAME}\` `;
    query += `binary(1) `;
    if (column.IS_NULLABLE === 'YES') {
      query += 'DEFAULT NULL';
    } else if (column.COLUMN_DEFAULT) {
      query += 'NOT NULL';
      if (column.COLUMN_DEFAULT) {
        query += ` DEFAULT ${column.COLUMN_DEFAULT}`;
      }
    }

    knex_data += `\n  .raw('${query}')`;
  });
  return knex_data;
}

const mapCorruptedAutoIncremented = function(table_definition) {
  const mapped = table_definition.map((column) => {
    if (column.EXTRA !== 'auto_increment') {
      return column;
    }
    if (column.COLUMN_KEY !== 'PRI') {
      column.not_primary = true;
    }

    column.unsigned = isUnsigned(column);
    column.digits = column.COLUMN_TYPE.replace(/.*\(([0-9]+)\).*/gi, '$1');
    column.digits = column.digits && parseInt(column.digits);
    return column;
  });

  return mapped.filter((column) => {
    return column.EXTRA === 'auto_increment' && (column.not_primary || column.unsigned === false || column.digits !== 10);
  });
}

const insertIncremetedAdjustments = function(knex_data, table_name, columns) {
  columns.forEach((column) => {
    let query = `ALTER TABLE \`${table_name}\` MODIFY COLUMN \`${column.COLUMN_NAME}\``;
    query += ` int${column.digits ? `(${column.digits})` : ''}`;
    query += ` ${column.unsigned ? 'unsigned ' : ''}NOT NULL AUTO_INCREMENT`;
    knex_data += `\n  .raw('${query}')`;

    if (column.not_primary) {
      const drop_primary_query = `ALTER TABLE \`${table_name}\` DROP PRIMARY KEY;`
      knex_data += `\n  .raw('${drop_primary_query}')`;
    }
  });

  return knex_data;
}

/**
 * Generate tables data to be written in the files
 *
 * @param {array} table_definition
 * @param {string} table_name
 * @param {string} table_info
 * @returns {string} knex_data
 */
const generateTableMigration = (table_definition, table_name, table_info) => {
  return new Promise((resolve, reject) => {
    let knex_data_raw = '';
    let knex_data = addTopConstructor(table_name, 'table');
    let contains_pK = false;
    const columns_match = [];

    // Iterating columns
    table_definition.forEach((column, index) => {
      if (column.COLUMN_KEY) {
        // Handle keyed columns
        knex_data = mapKeys(column, contains_pK, knex_data);
        contains_pK = true;
      } else {
        // Handle NOT keyed columns
        knex_data = mapTypes(column, knex_data);
      }
      const row = mapAutoGeneratedColumns(column, table_info, table_name );
      if (row) {
        columns_match.push({ index, row })
      }
    });

    knex_data = knex_data
      .addCaracters('  ')
      .addCaracters('})');

    // Inserting auto-generated columns
    if (columns_match && columns_match.length) {
      knex_data = knex_data.addEndLine();
      knex_data_raw = columns_match.map(({ row }) => row).join('\n');
      knex_data += knex_data_raw;
    }

    // Getting table indexes
    indexes_data = mapIndexes(table_info);
    if (indexes_data) {
      knex_data = insertIndexes(knex_data, table_name, indexes_data);
    }

    // Adjusting char columns
    char_columns = table_definition.filter(c => c.DATA_TYPE === 'char');
    if (char_columns) {
      knex_data = adjustCharColumns(knex_data, table_name, char_columns);
    }

    // Adjusting binary columns
    binary_columns = table_definition.filter(c => c.DATA_TYPE === 'binary');
    if (binary_columns) {
      knex_data = adjustBinaryColumns(knex_data, table_name, binary_columns);
    }

    // Adjusting auto-incremented columns that aren't "unsigned"
    // Knex by default set auto-incremented columns as unsigned
    auto_incremented_columns = mapCorruptedAutoIncremented(table_definition);
    if (auto_incremented_columns) {
      knex_data = insertIncremetedAdjustments(knex_data, table_name, auto_incremented_columns);
    }

    knex_data = knex_data.addCaracters(';');

    knex_data += addBottomConstructor(table_name, 'table');

    resolve(knex_data);
  })
}

/**
 * Generate FK data to be written in the files
 *
 * @param {string} table_name
 * @param {string} table_info
 * @returns {string} knex_data_fks
 */
const generateFKs = (table_name, table_info) => {
  return new Promise((resolve, reject) => {
    const re_constraints = new RegExp(`CONSTRAINT \`.*\` FOREIGN KEY \(\`?(.*)\`?\) REFERENCES \`(.*)\` \(\`?(.*)\`?\)[,|\n]`, 'gim');
    const constraint_match = table_info.match(re_constraints);

    if (!constraint_match) {
      return resolve('');
    }

    knex_data_fks = handleKFs(constraint_match, table_name);
    resolve(knex_data_fks);
  })
}

/**
 * Generate views data to be written in the files
 *
 * @param {string} view_definition
 * @param {string} view_name
 * @returns {string} knex_data
 */
const generateViewMigration = (view_definition, view_name) => {
  return new Promise((resolve, reject) => {
    let knex_data = addTopConstructor(view_name, 'view');

    view_definition = view_definition.replace(/\"/gim, '\\"');

    knex_data += view_definition;
    knex_data = knex_data.addCaracters('");');
    knex_data += addBottomConstructor(view_name, 'view');

    resolve(knex_data);
  })
}

module.exports = {
  generateTableMigration,
  generateFKs,
  generateViewMigration,
};
