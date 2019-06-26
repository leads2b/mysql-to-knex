#!/usr/bin/env node

require('dotenv').config();

const DATABASE = process.env.MYSQL_DATABASE;
const USER = process.env.MYSQL_USER;
const PASS = process.env.MYSQL_PASS;
const HOST = process.env.MYSQL_HOST;

if (!DATABASE || !USER || !PASS || !HOST) {
  console.error('Some configuration is missing, please set the .env file with the configuration or pass it through parameters');
  process.exit(1);
}

const logger = require('./utils/logger');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const mysql = require('./config/mysql.js');
const { generateTableMigration, generateFKs, generateViewMigration } = require('./utils/migrations.js');
const chalk = require('chalk');
const start = Date.now();

const createMigrationFile = (file_data, entity_name, db_name, type) => {
  return new Promise((resolve, reject) => {
    // Creating migrations' directory
    const pathMigrations = './migrations';
    fs.mkdir(path.resolve(__dirname, pathMigrations), { recursive: true }, (err) => {
      if (err && err.code !== 'EEXIST') {
        logger.log({
          level: 'error',
          message: err,
        });
      }
      const pathToWrite = `${pathMigrations}/${db_name}`;
      fs.mkdir(path.resolve(__dirname, pathToWrite), { recursive: true }, (err) => {
        if (err && err.code !== 'EEXIST') {
          logger.log({
            level: 'error',
            message: err,
          });
        }
        // 5 second more in the begin of views file name to make these files go to final of files
        // because views need to be processed after regular tables
        const dateNowView = moment().add(5, 'seconds').format('YYYYMMDDHHmmss');
        const dateNowFK = moment().add(10, 'seconds').format('YYYYMMDDHHmmss');
        const dateNow = type === 'TABLE' ? moment().format('YYYYMMDDHHmmss') : (type === 'VIEW' ? dateNowView : dateNowFK);
        const filename = type === 'FK' ? `${dateNow}_create_fk_${entity_name.toLowerCase()}.js` : `${dateNow}_create_${entity_name.toLowerCase()}.js`;

        // Writing file in its respective directory
        const stream = fs.createWriteStream(path.resolve(__dirname, `${pathToWrite}/${filename}`));
        stream.write(file_data);

        // Returning stream promise
        stream.end(() => {
          console.info(`File ${filename} written successfully`);
          resolve(true);
        })
      });
    });
  });
}

const processTables = (tables, pool, DATABASE) => {
  return new Promise((resolve, reject) => {
    if (tables && tables.length) {
      // Iterating through tables
      tables.forEach(async (table_name, index) => {
        // Get table definition
        const table_definition = await mysql.getTableDefinition(pool, table_name, DATABASE);
        // Get table info
        const table_info = await mysql.getTableCreation(pool, table_name, DATABASE);
        // Generating the knex data to be written
        const migration_data = await generateTableMigration(table_definition, table_name, table_info);
        // Getting FKs data and creating file for them
        // const fk_data = await generateFKs(table_name, table_info);
        // if (fk_data) {
        //   await createMigrationFile(fk_data, table_name, DATABASE, 'FK');
        // }
        // Creating the files
        await createMigrationFile(migration_data, table_name, DATABASE, 'TABLE');
        if (index === (tables.length - 1)) {
          resolve(true);
        }
      });
    } else {
      resolve(true);
    }
  });
}

const processViews = (views, pool, DATABASE) => {
  return new Promise((resolve, reject) => {
    if (views && views.length) {
      // Iterating through views
      views.forEach(async (view_name, index) => {
        // Get view definition
        let view_definition = await mysql.getViewCreation(pool, view_name, DATABASE);
        view_definition = view_definition.replace(/CREATE\sALGORITHM=.*=\`[a-zA-Z]+\`@\`.*\`\sSQL.*VIEW\s/gi, '');
        const re_db = new RegExp(`\`?${DATABASE}\`?\.`, 'gi'); // removing DATABASE name from views definition
        view_definition = view_definition.replace(re_db, '');
        // Generating the knex data to be written
        const migration_data = await generateViewMigration(view_definition, view_name);
        // Creating the files
        await createMigrationFile(migration_data, view_name, DATABASE, 'VIEW');
        if (index === (views.length - 1)) {
          resolve(true);
        }
      });
    } else {
      resolve(true);
    }
  });
}

// Main function
(async () => {
  try {
    console.info(chalk.red('The main process was started'));
    const objConn = {
      host: HOST,
      user: USER,
      password: PASS,
      database: DATABASE,
    };
    // Initializing the mysql connection
    const pool = mysql.init(objConn);

    // Tables handling
    let tables = await mysql.getDatabaseTables(pool, DATABASE);
    tables = tables.map(res => res[`Tables_in_${DATABASE}`]);
    await processTables(tables, pool, DATABASE);

    // Views handling
    let views = await mysql.getDatabaseViews(pool, DATABASE);
    views = views.map(res => res[`Tables_in_${DATABASE}`]);
    await processViews(views, pool, DATABASE);

    console.info(chalk.red('All files written successfully'));
    // Close all MySQL connections
    pool.end((err) => {
      if (err) {
        logger.log({
          level: 'error',
          message: err,
        });
      }
    });

    const execution_time = Date.now() - start;
    console.info(`Execution took ${chalk.red(execution_time)} ms`);
  } catch (err) {
    logger.log({
      level: 'error',
      message: err,
    });
  }
})();
