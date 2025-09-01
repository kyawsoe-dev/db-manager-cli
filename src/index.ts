#!/usr/bin/env node
import { Command } from "commander";
import fs from "fs";
import YAML from "yaml";
import path from "path";
import { loadConfig, promptForMissingCredentials, saveConfig } from "./config";
import { makeAdapter } from "./factory";
import { SqlCapable, AnyDbConfig } from "./types";
import { testConnection } from "./utils/testConnection";
import { ensureDatabaseExists } from "./utils/ensureDatabase";

import prompts from "prompts";
const program = new Command();

program.name("dbman").description("Multi-DB manager CLI").version("0.1.0");

function getCfgOrDie(name: string) {
  const cfgs = loadConfig();
  const cfg = cfgs[name];
  if (!cfg) throw new Error(`Unknown connection "${name}". Use "dbman list"`);
  return cfg;
}
function getUserConfigFile() {
  return path.join(process.env.HOME || ".", ".dbman.yaml");
}

function getProjectConfigFile() {
  return path.resolve(process.cwd(), ".dbman.yaml");
}

// Add or update connection
program
  .command("config")
  .description("Add or update a DB connection")
  .action(async () => {
    const basic = await prompts([
      { type: "text", name: "name", message: "Connection name:" },
      {
        type: "select",
        name: "type",
        message: "DB type:",
        choices: [
          { title: "Postgres", value: "postgres" },
          { title: "MySQL", value: "mysql" },
          { title: "MongoDB", value: "mongo" },
        ],
      },
    ]);

    let defaults: any = {};
    switch (basic.type) {
      case "postgres":
        defaults = { port: 5432, user: "postgres", database: "appdb" };
        break;
      case "mysql":
        defaults = { port: 3306, user: "root", database: "appdb" };
        break;
      case "mongo":
        defaults = { uri: "mongodb://localhost:27017", dbName: "test" };
        break;
    }

    const details = await prompts([
      {
        type: "text",
        name: "host",
        message: "Host:",
        initial: defaults.host || "localhost",
      },
      {
        type: "number",
        name: "port",
        message: "Port:",
        initial: defaults.port,
      },
      { type: "text", name: "user", message: "User:", initial: defaults.user },
      { type: "password", name: "password", message: "Password:" },
      {
        type: "text",
        name: "database",
        message: "Database name:",
        initial: defaults.database,
      },
      {
        type: "text",
        name: "uri",
        message: "Mongo URI (if mongo):",
        initial: defaults.uri,
      },
    ]);

    let cfg: AnyDbConfig;
    if (basic.type === "mongo") {
      cfg = {
        type: "mongo",
        uri: details.uri,
        dbName: details.database || defaults.dbName,
        name: basic.name,
      };
    } else {
      cfg = {
        type: basic.type,
        host: details.host,
        port: details.port,
        user: details.user,
        password: details.password,
        database: details.database,
        name: basic.name,
      };
    }

    try {
      console.log("🔄 Testing connection...");
      if (basic.type !== "mongo") await ensureDatabaseExists(cfg);
      await testConnection(cfg);
      saveConfig(basic.name, cfg);
      console.log(`✅ Connection "${basic.name}" saved and verified.`);
    } catch (err: any) {
      console.error(`❌ Failed to connect:`, err.message);
    }
  });

// delete connection
program
  .command("delete <name>")
  .description("Delete a connection from config")
  .action((name: string) => {
    const files = [getProjectConfigFile(), getUserConfigFile()];
    let deleted = false;

    for (const file of files) {
      if (!fs.existsSync(file)) continue;

      const doc = YAML.parse(fs.readFileSync(file, "utf8")) || {
        connections: {},
      };

      if (doc.connections[name]) {
        delete doc.connections[name];
        fs.writeFileSync(file, YAML.stringify(doc), "utf8");
        console.log(`✅ Connection "${name}" deleted from ${file}`);
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      console.error(`❌ Connection "${name}" not found in any config file`);
      process.exit(1);
    }
  });

// List connections
program
  .command("list")
  .description("List connections")
  .action(() => {
    const cfgs = loadConfig();
    console.table(
      Object.values(cfgs).map((c) => ({ name: c.name, type: c.type }))
    );
  });

// Test connection
program
  .command("test")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Test a connection")
  .action(async (opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);
    try {
      await adapter.connect();
      console.log(`✅ ${cfg.name} (${cfg.type}) OK`);
    } catch (e: any) {
      console.error(`❌ ${cfg.name} failed:`, e.message);
      process.exitCode = 1;
    } finally {
      await adapter.close().catch(() => {});
    }
  });

// Run SQL query
program
  .command("query")
  .requiredOption("-q, --query <sql>", "SQL to execute")
  .option("-d, --db <name>", "Connection name", "default")
  .option("--json", "Print JSON instead of table", false)
  .description("Run SQL query")
  .action(async (opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);
    if (adapter.kind() === "mongo") {
      console.error("Use Mongo commands for MongoDB");
      process.exit(1);
      return;
    }
    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    const rows = await sqlAdapter.query(opts.query, []);
    if (opts.json) console.log(JSON.stringify(rows, null, 2));
    else console.table(rows);
    await adapter.close();
  });

// Create a new database
program
  .command("create-db <dbname>")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Create a new database")
  .action(async (dbname, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    if (adapter.kind() === "mongo") {
      console.error(
        "MongoDB uses databases dynamically, no explicit create needed."
      );
      return;
    }

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    await sqlAdapter.query(`CREATE DATABASE ${dbname}`);
    console.log(`✅ Database "${dbname}" created.`);
    await adapter.close();
  });

// Drop a database
program
  .command("drop-db <dbname>")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Drop a database")
  .action(async (dbname, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    if (adapter.kind() === "mongo") {
      console.error("Use Mongo shell/driver to drop databases.");
      return;
    }

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    await sqlAdapter.query(`DROP DATABASE ${dbname}`);
    console.log(`✅ Database "${dbname}" dropped.`);
    await adapter.close();
  });

// Create a new table
program
  .command("create-table <table>")
  .option(
    "-c, --columns <cols...>",
    "Column definitions, e.g. name:string age:int"
  )
  .option("-d, --db <name>", "Connection name", "default")
  .description("Create a new table")
  .action(async (table, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    if (adapter.kind() === "mongo") {
      console.error("MongoDB creates collections dynamically on insert.");
      return;
    }

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;

    const cols = (opts.columns || []).map((c: string) => {
      const [name, type] = c.split(":");
      return `${name} ${type.toUpperCase()}`;
    });

    const sql = `CREATE TABLE ${table} (${cols.join(", ")})`;
    await sqlAdapter.query(sql);
    console.log(`✅ Table "${table}" created.`);
    await adapter.close();
  });

// Drop a table
program
  .command("drop-table <table>")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Drop a table")
  .action(async (table, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    if (adapter.kind() === "mongo") {
      console.error("Use Mongo command to drop collections.");
      return;
    }

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    await sqlAdapter.query(`DROP TABLE ${table}`);
    console.log(`✅ Table "${table}" dropped.`);
    await adapter.close();
  });

// SELECT
program
  .command("select <table>")
  .option("-w, --where <condition>", "WHERE clause, e.g. age>30")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Select rows from a table")
  .action(async (table, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    const sql = `SELECT * FROM ${table} ${
      opts.where ? `WHERE ${opts.where}` : ""
    }`;
    const rows = await sqlAdapter.query(sql, []);
    console.table(rows);
    await adapter.close();
  });

// INSERT
program
  .command("insert <table>")
  .option(
    "-v, --values <pairs...>",
    "Column=Value pairs, e.g. name=John age=30"
  )
  .option("-d, --db <name>", "Connection name", "default")
  .description("Insert a row")
  .action(async (table, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;

    const entries = (opts.values || []).map((v: string) => v.split("="));
    const cols = entries.map(([col]) => col);
    const vals = entries.map(([_, val]) => `'${val}'`);

    const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${vals.join(
      ","
    )})`;
    await sqlAdapter.query(sql);
    console.log(`✅ Row inserted into "${table}"`);
    await adapter.close();
  });

// UPDATE
program
  .command("update <table>")
  .option("-s, --set <pairs...>", "Column=Value pairs")
  .option("-w, --where <condition>", "WHERE clause")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Update rows")
  .action(async (table, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;

    const sets = (opts.set || []).map((s: string) => {
      const [col, val] = s.split("=");
      return `${col}='${val}'`;
    });

    const sql = `UPDATE ${table} SET ${sets.join(", ")} ${
      opts.where ? `WHERE ${opts.where}` : ""
    }`;
    await sqlAdapter.query(sql);
    console.log(`✅ Rows updated in "${table}"`);
    await adapter.close();
  });

// DELETE
program
  .command("delete-row <table>")
  .option("-w, --where <condition>", "WHERE clause")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Delete rows")
  .action(async (table, opts) => {
    let cfg = getCfgOrDie(opts.db);
    cfg = await promptForMissingCredentials(cfg);
    const adapter = makeAdapter(cfg);

    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    const sql = `DELETE FROM ${table} ${
      opts.where ? `WHERE ${opts.where}` : ""
    }`;
    await sqlAdapter.query(sql);
    console.log(`✅ Rows deleted from "${table}"`);
    await adapter.close();
  });

program.parseAsync(process.argv);
