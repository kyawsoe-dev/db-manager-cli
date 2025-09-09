# 🚀 DBMAN CLI — Multi‑Database Manager CLI

`dbman` is a CLI tool to manage multiple databases from a single interface. It supports **Postgres**, **MySQL**, and **MongoDB** for connection management and adds convenient **SQL helpers** for common operations.

---

## ✨ Features

- 🔧 Manage connections for **Postgres, MySQL, MongoDB**
- 🧪 Test connections with one command
- 🧰 Run arbitrary SQL (`query`) on Postgres/MySQL

  - `create-db`, `drop-db`
  - `create-table`, `drop-table`
  - `select`, `insert`, `update`, `delete-row`

---

## 📦 Installation

```bash
npm i -g multi-dbman-cli
```

---

## 🚀 Quick Start (Step‑by‑Step)

### 1) Add a connection

```bash
dbman config
```

Follow the prompts to name your connection and choose the DB type. Values are saved into the nearest `.dbman.yaml`.

### 2) List connections

```bash
dbman list
```

Shows all known connections (from project/user config).

```plaintext
┌─────────┬──────────────┬────────────┬─────────────┬──────┬────────────┬──────────────┬─────────────────────────────┬────────┐
│ (index) │ name         │ type       │ host        │ port │ user       │ database     │ uri                         │ dbName │
├─────────┼──────────────┼────────────┼─────────────┼──────┼────────────┼──────────────┼─────────────────────────────┼────────┤
│ 0       │ 'mypg'       │ 'postgres' │ 'localhost' │ 5432 │ 'postgres' │ 'appdb'      │                             │        │
│ 1       │ 'mymysql'    │ 'mysql'    │ 'localhost' │ 3306 │ 'root'     │ 'appdb'      │                             │        │
│ 2       │ 'test-pg'    │ 'postgres' │ 'localhost' │ 5432 │ 'postgres' │ 'testpg_db'  │                             │        │
│ 3       │ 'test-mysql' │ 'mysql'    │ 'localhost' │ 3306 │ 'root'     │ 'testsql_db' │                             │        │
│ 4       │ 'mymongo'    │ 'mongo'    │             │      │            │              │ 'mongodb://localhost:27017' │ 'test' │
└─────────┴──────────────┴────────────┴─────────────┴──────┴────────────┴──────────────┴─────────────────────────────┴────────┘
```

### 3) Test a connection

```bash
# Test a specific one
dbman test -d mypg
```

✅ mymongo (mongo) OK

### 4) Check DB servers (doctor)

```bash
# Check all configured DB connections
dbman doctor
```

> Verify that your configured database servers are running. If a server is not reachable, doctor shows OS-specific installation and startup instructions. Works for Postgres, MySQL, and MongoDB.

| Connection   | Type      | Status  | Details / Fix |
|-------------|-----------|---------|---------------|
| mypg        | postgres  | ❌      | Cannot connect to postgres at localhost:5432. Run: `sudo apt update && sudo apt install postgresql && sudo systemctl start postgresql` |
| mymysql     | mysql     | ✅      | mysql is running at localhost:3306 |
| test-pg     | postgres  | ❌      | Cannot connect to postgres at localhost:5432. Run: `sudo apt update && sudo apt install postgresql && sudo systemctl start postgresql` |
| test-mysql  | mysql     | ✅      | mysql is running at localhost:3306 |
| mymongo     | mongo     | ✅      | MongoDB is running at mongodb://localhost:27017 |


### 5) Create a database (Postgres/MySQL)

> You must connect to a server-level database that allows creating others (e.g., `postgres` on Postgres, or any DB on MySQL with permissions).

```bash
dbman create-db appdb -d mypg
```

### 6) Create a table (Postgres/MySQL)

Provide columns as `name:TYPE`. The tool uppercases the type for convenience.

```bash
# Postgres example
dbman create-table users -d mypg -c "id:SERIAL PRIMARY KEY" -c "name:TEXT" -c "age:INT" -c "email:VARCHAR(255)"

# MySQL example
dbman create-table products -d mymysql -c "id:INT PRIMARY KEY AUTO_INCREMENT" -c "name:VARCHAR(255)" -c "price:DECIMAL(10,2)"
```

### 7) Insert rows (Postgres/MySQL)

Provide column=value pairs. Values are inserted as strings; most RDBMS will coerce types where possible.

```bash
dbman insert users -d mypg -v "name=Alice" "age=25" "email=alice@example.com"
```

### 8) Select rows (Postgres/MySQL)

Use a simple `WHERE` expression (raw SQL).

```bash
# All rows
dbman select users -d mypg

# Filtered
dbman select users -d mypg -w "age >= 18"
```

### 9) Update rows (Postgres/MySQL)

```bash
dbman update users -d mypg -s "age=26" -s "email=alice26@example.com" -w "name='Alice'"
```

### 10) Delete rows (Postgres/MySQL)

```bash
dbman delete-row users -d mypg -w "age < 18"
```

### 11) Drop a table (Postgres/MySQL)

```bash
dbman drop-table users -d mypg
```

### 12) Drop a database (Postgres/MySQL)

```bash
dbman drop-db appdb -d mypg
```

### 13) Run arbitrary SQL (Postgres/MySQL)

```bash
# Against the default connection
dbman query -q "SELECT * FROM users ORDER BY id DESC;"

# Against a specific connection
dbman query -d mymysql -q "SELECT COUNT(*) AS c FROM products;"

# JSON output (only for `query`)
dbman query -d mymysql -q "SELECT * FROM products LIMIT 5;" --json
```

---

## 🐘 Postgres quick demo

```bash
dbman config             # create `mypg`

dbman test -d mypg

dbman create-db appdb -d mypg

# point `mypg` at `appdb` in .dbman.yaml, then:
dbman create-table users -d mypg -c "id:SERIAL PRIMARY KEY" -c "name:TEXT" -c "age:INT" -c "email:VARCHAR(255)"

dbman insert users -d mypg -v "name=Alice" "age=25" "email=alice@example.com"

dbman select users -d mypg -w "age >= 18"

dbman update users -d mypg -s "age=26" -w "name='Alice'"

dbman delete-row users -d mypg -w "age < 18"
```

---

## 🐬 MySQL quick demo

```bash
dbman config             # create `mymysql`

dbman test -d mymysql

dbman create-db shopdb -d mymysql

# point `mymysql` at `shopdb` in .dbman.yaml, then:
dbman create-table products -d mymysql -c "id:INT PRIMARY KEY AUTO_INCREMENT" -c "name:VARCHAR(255)" -c "price:DECIMAL(10,2)"

dbman insert products -d mymysql -v "name=Keyboard" "price=39.90"

dbman select products -d mymysql
```

---

## 🍃 MongoDB note (DBMAN CLI)

- You can **configure** and **test** MongoDB connections using `dbman config` and `dbman test`.

#### List collections

```bash
dbman mongo-list-collections -d mymongo
```

#### Insert a document (creates collection if not exists)

```bash
dbman mongo-insert <collection-name> -d mymongo "name=Mg Mg" "age=25" "email=mgmg@example.com"
```

#### Update a document

```bash
dbman mongo-update <collection-name> -d mymongo -s "age=26" -w '{"name":"Alice"}'
```

#### Find documents

```bash
dbman mongo-find <collection-name> -d mymongo -w '{"age":{"$gte":18}}'
```

#### Delete a document

```bash
dbman mongo-delete <collection-name> -d mymongo -w '{"name":"Alice"}'
```

#### Drop a collection

```bash
dbman mongo-drop-collection <collection-name> -d mymongo
```

---

## 🔧 Uninstall

```bash
npm uninstall -g multi-dbman-cli
```
