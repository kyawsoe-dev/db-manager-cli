# 🚀 DBMAN CLI - Multi-Database Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

`dbman` is a CLI tool to manage multiple databases (**Postgres, MySQL, MongoDB**) from a single interface. You can list connections, test them, inspect tables/collections, and run queries directly from the terminal.

---

## 📦 Features

- 🔧 Manage **Postgres, MySQL, and MongoDB** databases
- 🗃️ List configured connections
- ✅ Test database connections
- 📜 Run SQL queries and inspect tables
- 🧩 Run MongoDB queries and inspect collections
- 🌐 Support for `.env` and `.dbman.yaml` for dynamic configuration

Compatible with **Node.js >=18**.

---

## 📥 Installation

```bash
npm install
```

## 🚀 Usage Step by Step

### 1️⃣ List Configured Connections

```bash
# List all connections in .dbman.yaml or default DB from .env
dbman list
```

### 2️⃣ Test Database Connections

#### Test a specific database connection

dbman test -d mypg
dbman test -d mymysql
dbman test -d mymongo

#### Test the default connection (from .env or default config)

dbman test

### 3️⃣ Run SQL Queries and Inspect Tables (Postgres / MySQL)

dbman sql:tables -d mypg
dbman sql:tables -d mymysql

#### Execute query on default DB

dbman query -q "SELECT \* FROM tbl_user;"

#### Execute query on specific DB

dbman query -q "SELECT \* FROM tbl_user ORDER BY id DESC;" -d mypg

# Quick shortcut (SQL as first argument)

dbman "SELECT \* FROM tbl_user;" -d mymysql

#### Output JSON instead of table

dbman "SELECT \* FROM tbl_user;" -d mymysql --json

### 4️⃣ Run MongoDB Queries and Inspect Collections

#### Find documents with filter

dbman mongo:find -d mymongo -c users -f '{"age": {"$gte": 18}}' -l 10

#### Select specific fields

dbman mongo:find -d mymongo -c users -s '{"name": 1, "email": 1}' -l 5

#### Output JSON

dbman mongo:find -d mymongo -c users -f '{"active": true}' --json

### 5️⃣ Create Database (Example: Postgres)

1. Connect to an existing database temporarily (e.g., postgres system DB):

connections:
  mypg_temp:
    type: postgres
    host: localhost
    port: 5432
    user: postgres
    password: postgres
    database: postgres

2. Run:
dbman query -d mypg_temp -q "CREATE DATABASE appdb;"

3. Update .dbman.yaml to point your connection to the new database:
mypg:
  type: postgres
  host: localhost
  port: 5432
  user: postgres
  password: postgres
  database: appdb


### 6️⃣ Help Commands

#### Show all commands
dbman --help

#### Show command-specific help
dbman query --help
dbman mongo:find --help
