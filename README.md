# 🚀 DBMAN CLI — Multi‑Database Manager

`dbman` is a CLI tool to manage multiple databases from a single interface. It supports **Postgres**, **MySQL**, and **MongoDB** for connection management and adds convenient **SQL helpers** for common operations.

---

## ✨ Features

- 🔧 Manage connections for **Postgres, MySQL, MongoDB**
- 🗂️ Store connections in project or user config (`.dbman.yaml`)
- 🧪 Test connections with one command
- 🧰 Run arbitrary SQL (`query`) on Postgres/MySQL
- 🏗️ SQL helpers for beginners:

  - `create-db`, `drop-db`
  - `create-table`, `drop-table`
  - `select`, `insert`, `update`, `delete-row`

- 🔐 Interactive prompts for missing credentials (username/password)

> ℹ️ MongoDB: currently supported for **connections** only in this CLI entrypoint. SQL helpers apply to Postgres/MySQL.

---

## 📦 Installation

```bash
npm i -g multi-dbman-cli
```

---

## ⚙️ Configuration

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

### 3) Test a connection

```bash
# Test a specific one
dbman test -d mypg
```

### 4) Create a database (Postgres/MySQL)

> You must connect to a server-level database that allows creating others (e.g., `postgres` on Postgres, or any DB on MySQL with permissions).

```bash
dbman create-db appdb -d mypg
```

### 5) Create a table (Postgres/MySQL)

Provide columns as `name:TYPE`. The tool uppercases the type for convenience.

```bash
# Basic
dbman create-table users -d mypg \
  -c "id:SERIAL PRIMARY KEY" "name:TEXT" "age:INT" "email:VARCHAR(255)"

# MySQL example
dbman create-table products -d mymysql \
  -c "id:INT PRIMARY KEY AUTO_INCREMENT" "name:VARCHAR(255)" "price:DECIMAL(10,2)"
```

### 6) Insert rows (Postgres/MySQL)

Provide column=value pairs. Values are inserted as strings; most RDBMS will coerce types where possible.

```bash
dbman insert users -d mypg -v "name=Alice" "age=25" "email=alice@example.com"
```

### 7) Select rows (Postgres/MySQL)

Use a simple `WHERE` expression (raw SQL).

```bash
# All rows
dbman select users -d mypg

# Filtered
dbman select users -d mypg -w "age >= 18"
```

### 8) Update rows (Postgres/MySQL)

```bash
dbman update users -d mypg \
  -s "age=26" "email=alice26@example.com" \
  -w "name='Alice'"
```

### 9) Delete rows (Postgres/MySQL)

```bash
dbman delete-row users -d mypg -w "age < 18"
```

### 10) Drop a table (Postgres/MySQL)

```bash
dbman drop-table users -d mypg
```

### 11) Drop a database (Postgres/MySQL)

```bash
dbman drop-db appdb -d mypg
```

### 12) Run arbitrary SQL (Postgres/MySQL)

```bash
# Against the default connection
dbman query -q "SELECT * FROM users ORDER BY id DESC;"

# Against a specific connection
dbman query -d mymysql -q "SELECT COUNT(*) AS c FROM products;"

# JSON output (only for `query`)
dbman query -d mymysql -q "SELECT * FROM products LIMIT 5;" --json
```

---

## 🧭 Command Reference

### `dbman config`

Interactive add/update of a connection. Saves to the nearest `.dbman.yaml`.

### `dbman delete <name>`

Delete a saved connection (project file has priority over user file).

### `dbman list`

List all configured connections (name + type).

### `dbman test [-d <name>]`

Test connectivity for the given connection (defaults to `default`).

### `dbman query -q <sql> [-d <name>] [--json]`

Run an arbitrary SQL statement (Postgres/MySQL only). `--json` prints raw JSON instead of a table.

### `dbman create-db <dbname> [-d <name>]`

Create a new database on the target server (Postgres/MySQL only).

### `dbman drop-db <dbname> [-d <name>]`

Drop a database (Postgres/MySQL only).

### `dbman create-table <table> -c "col:TYPE" ["col2:TYPE ..."] [-d <name>]`

Create a table with the provided columns (Postgres/MySQL only). Types are raw SQL — examples: `TEXT`, `INT`, `BIGINT`, `VARCHAR(255)`, `SERIAL PRIMARY KEY`, `DECIMAL(10,2)`, etc.

### `dbman drop-table <table> [-d <name>]`

Drop the given table (Postgres/MySQL only).

### `dbman select <table> [-w <where>] [-d <name>]`

Select `*` from a table with an optional `WHERE` clause (Postgres/MySQL only).

### `dbman insert <table> -v "col=value" ["col2=value" ...] [-d <name>]`

Insert a single row using `col=value` pairs (Postgres/MySQL only). Values are quoted as strings.

### `dbman update <table> -s "col=value" ["col2=value" ...] [-w <where>] [-d <name>]`

Update rows using `SET` pairs with an optional `WHERE` clause (Postgres/MySQL only).

### `dbman delete-row <table> [-w <where>] [-d <name>]`

Delete rows from a table with an optional `WHERE` clause (Postgres/MySQL only).

---

## 📝 Notes & Tips

- 🔒 **Safety**: helper commands build SQL strings directly; avoid untrusted input.
- 🧩 **Types**: use real SQL types in `create-table` (e.g., `VARCHAR(255)`, `TEXT`, `INT`). The CLI uppercases whatever you provide.
- 🆔 **Identifiers**: if your table/column name is case‑sensitive or reserved, quote it yourself in the `WHERE`/values (e.g., `"\"User\""`).
- 🧮 **Functions**: helper commands quote values; DB functions like `NOW()` will be treated as strings. Use `dbman query` for advanced SQL.
- 📂 **Config precedence**: project `.dbman.yaml` overrides user `~/.dbman.yaml`.
- 🔑 **Prompts**: missing credentials (like password) are prompted at runtime and **not** written back unless you explicitly provide them in YAML via `dbman config`.

---

## 🐘 Postgres quick demo

```bash
dbman config             # create `mypg`
dbman test -d mypg

dbman create-db appdb -d mypg

# point `mypg` at `appdb` in .dbman.yaml, then:
dbman create-table users -d mypg \
  -c "id:SERIAL PRIMARY KEY" "name:TEXT" "age:INT" "email:VARCHAR(255)"

dbman insert users -d mypg -v "name=Alice" "age=25" "email=alice@example.com"
dbman select users -d mypg -w "age >= 18"

dbman update users -d mypg -s "age=26" -w "name='Alice'"
dbman delete-row users -d mypg -w "age < 18"
```

## 🐬 MySQL quick demo

```bash
dbman config             # create `mymysql`
dbman test -d mymysql

dbman create-db shopdb -d mymysql

# point `mymysql` at `shopdb` in .dbman.yaml, then:
dbman create-table products -d mymysql \
  -c "id:INT PRIMARY KEY AUTO_INCREMENT" "name:VARCHAR(255)" "price:DECIMAL(10,2)"

dbman insert products -d mymysql -v "name=Keyboard" "price=39.90"
dbman select products -d mymysql
```

## 🍃 MongoDB note

- You can **configure** and **test** MongoDB connections.
- SQL helper commands (`create-table`, `insert`, etc.) are **not applicable** to Mongo.
- Use your preferred Mongo client for CRUD, or extend DBMAN with Mongo commands in a future version.

---

## 🔧 Uninstall

```bash
npm uninstall -g multi-dbman-cli
```