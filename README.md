# MySQL to Knex Converter

[![Build Status](https://badgen.net/travis/julio-cesar-development/mysql-to-knex?icon=travis)](https://travis-ci.org/julio-cesar-development/mysql-to-knex)
![Language](https://badgen.net/badge/language/javascript/green)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

> Tools to easily migrate MySQL schemas to Knex migration files

## Requirements

* Node JS
* NPM

-------------

## Instructions

* Install the required packages with the following command:

```bash
npm install
```

* The parameters can be passed through .env file
* Create the .env file in the root directory with the following definitions:
  * MYSQL_SERVER
  * MYSQL_USER
  * MYSQL_PASS
  * MYSQL_DATABASE

> Use the .env.sample as example to set the *.env* file with your configurations and rename it to *.env*.
>
> It's possible create migration for one table, or for all tables in the defined DB.

## Running

### Creating migration files

* Running script [main.js](main.js):

```bash
# It will create the knex migrations files using the configuration from .env file
npm start
# or
./main.js
```

-------------

## Output format

> The script will create files with migrations definitions for each table in the defined Database
