require('dotenv').config();

const mysql = require('mysql');
const logger = require('../utils/logger.js');

// MySQL connection
const init = (conf) => {
  return mysql.createConnection(conf);
};

const getDatabaseTables = async (pool, DB) => {
  let query = 'SHOW FULL TABLES WHERE Table_Type != "VIEW"';
  if (process.env.MYSQL_TABLE) {
    query = `${query} AND Tables_in_${DB} = "${process.env.MYSQL_TABLE}"`;
  }
  return new Promise((resolve, reject) => {
    pool.query(query, async (err, tables) => {
      if (err) {
        logger.log({
          level: 'error',
          message: err,
        });
        reject(null);
      }
      resolve(tables);
    });
  });
};

const getDatabaseViews = async (pool, DB) => {
  let query = 'SHOW FULL TABLES WHERE Table_Type = "VIEW"';
  if (process.env.MYSQL_VIEW) {
    query = `${query} AND Tables_in_${DB} = "${process.env.MYSQL_VIEW}"`;
  }
  return new Promise((resolve, reject) => {
    pool.query(query, async (err, views) => {
      if (err) {
        logger.log({
          level: 'error',
          message: err,
        });
        reject(null);
      }
      resolve(views);
    });
  });
};

const getTableDefinition = async (pool, table, DB) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?';
    pool.query(query, [DB, table], async (err, definition) => {
      if (err) {
        logger.log({
          level: 'error',
          message: err,
        });
        reject(null);
      }
      let result = '';
      if (definition.length) {
        result = await definition;
      } else {
        result = null;
      }
      resolve(result);
    });
  });
};

const getTableCreation = async (pool, table, DB) => {
  return new Promise((resolve, reject) => {
    const query = `SHOW CREATE TABLE ${DB}.${table}`;
    pool.query(query, async (err, definition) => {
      if (err) {
        logger.log({
          level: 'error',
          message: err,
        });
        reject(null);
      }
      let result = '';
      if (definition.length) {
        result = await definition[0]['Create Table'];
      } else {
        result = null;
      }
      resolve(result);
    });
  });
};

const getViewCreation = async (pool, view, DB) => {
  return new Promise((resolve, reject) => {
    const query = `SHOW CREATE VIEW ${DB}.${view}`;
    pool.query(query, async (err, definition) => {
      if (err) {
        logger.log({
          level: 'error',
          message: err,
        });
        reject(null);
      }
      let result = '';
      if (definition.length) {
        result = await definition[0]['Create View'];
      } else {
        result = null;
      }
      resolve(result);
    });
  });
};

module.exports = {
  init,
  getDatabaseTables,
  getDatabaseViews,
  getTableDefinition,
  getTableCreation,
  getViewCreation,
};
