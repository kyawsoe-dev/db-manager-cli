#!/usr/bin/env node
import fs from "fs";
import YAML from "yaml";
import path from "path";
import prompts from "prompts";
import { Command } from "commander";
import { makeAdapter } from "./factory";
import { MongoAdapter } from "./adapters/MongoAdapter";
import { SqlCapable, AnyDbConfig } from "./types";
import { loadConfig, promptForMissingCredentials, saveConfig } from "./config";
import { testConnection, ensureDatabaseExists, runDoctor } from "./utils";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8")
);

const program = new Command();

program
  .name("dbman")
  .description("Multi-DB manager CLI")
  .version(packageJson.version, "-v, --version", "output the version number");

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

// Diagnose database setup
program
  .command("doctor")
  .description("Check DB servers and show installation guide if missing")
  .action(async () => {
    await runDoctor();
  });

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

    let cfg: AnyDbConfig;

    if (basic.type === "mongo") {
      const mongoDetails = await prompts([
        {
          type: "text",
          name: "uri",
          message: "Mongo URI:",
          initial: "mongodb://localhost:27017",
        },
        {
          type: "text",
          name: "dbName",
          message: "Database name:",
          initial: "test",
        },
      ]);

      cfg = {
        type: "mongo",
        uri: mongoDetails.uri,
        dbName: mongoDetails.dbName,
        name: basic.name,
      };
    } else {
      const defaults =
        basic.type === "postgres"
          ? {
              host: "localhost",
              port: 5432,
              user: "postgres",
              database: "appdb",
            }
          : { host: "localhost", port: 3306, user: "root", database: "appdb" };

      const details = await prompts([
        {
          type: "text",
          name: "host",
          message: "Host:",
          initial: defaults.host,
        },
        {
          type: "number",
          name: "port",
          message: "Port:",
          initial: defaults.port,
        },
        {
          type: "text",
          name: "user",
          message: "User:",
          initial: defaults.user,
        },
        { type: "password", name: "password", message: "Password:" },
        {
          type: "text",
          name: "database",
          message: "Database name:",
          initial: defaults.database,
        },
      ]);

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
      await ensureDatabaseExists(cfg);
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

    const tableData = Object.values(cfgs).map((c) => {
      const base: any = { name: c.name, type: c.type };

      if ("host" in c) base.host = c.host;
      if ("port" in c) base.port = c.port;
      if ("user" in c) base.user = c.user;
      if ("database" in c) base.database = c.database;

      if ("uri" in c) base.uri = c.uri;
      if ("dbName" in c) base.dbName = c.dbName;

      return base;
    });

    console.table(tableData);
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

// MongoDB specific utilities
function parseKeyValuePairs(pairs: string[]) {
  const obj: any = {};
  (pairs || []).forEach((pair) => {
    const [key, val] = pair.split("=");
    obj[key] = isNaN(Number(val)) ? val : Number(val);
  });
  return obj;
}

// List collections
program
  .command("mongo-list-collections")
  .option("-d, --db <name>", "Connection name", "default")
  .description("List all collections in a MongoDB database")
  .action(async (opts) => {
    const cfg = await promptForMissingCredentials(getCfgOrDie(opts.db));
    const adapter = makeAdapter(cfg) as MongoAdapter;

    if (adapter.kind() !== "mongo") {
      console.error("Not a MongoDB connection");
      process.exit(1);
    }

    await adapter.connect();
    const cols = await adapter.listCollections();
    console.table(cols);
    await adapter.close();
  });

// Insert document (creates collection if not exists)
program
  .command("mongo-insert <collection> [pairs...]")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Insert a document into a collection")
  .action(async (collection, pairs: string[], opts) => {
    const cfg = await promptForMissingCredentials(getCfgOrDie(opts.db));
    const adapter = makeAdapter(cfg) as MongoAdapter;

    await adapter.connect();
    const doc = parseKeyValuePairs(pairs || []);
    await adapter.insert(collection, doc);
    console.log(`✅ Document inserted into "${collection}"`);
    await adapter.close();
  });

// Find documents
program
  .command("mongo-find <collection>")
  .option("-w, --where <json>", "Filter as JSON string")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Find documents in a collection")
  .action(async (collection, opts) => {
    const cfg = await promptForMissingCredentials(getCfgOrDie(opts.db));
    const adapter = makeAdapter(cfg) as MongoAdapter;

    if (adapter.kind() !== "mongo") {
      console.error("Not a MongoDB connection");
      process.exit(1);
    }

    await adapter.connect();
    const filter = opts.where ? JSON.parse(opts.where) : {};
    const docs = await adapter.find(collection, filter);
    console.table(docs);
    await adapter.close();
  });

// Update documents
program
  .command("mongo-update <collection>")
  .option("-s, --set <pairs...>", "key=value pairs")
  .option("-w, --where <json>", "Filter as JSON string")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Update documents in a collection")
  .action(async (collection, opts) => {
    const cfg = await promptForMissingCredentials(getCfgOrDie(opts.db));
    const adapter = makeAdapter(cfg) as MongoAdapter;

    if (adapter.kind() !== "mongo") {
      console.error("Not a MongoDB connection");
      process.exit(1);
    }

    await adapter.connect();
    const filter = opts.where ? JSON.parse(opts.where) : {};
    const update = parseKeyValuePairs(opts.set || []);
    await adapter.update(collection, filter, update);
    console.log(`✅ Documents updated in "${collection}"`);
    await adapter.close();
  });

// Delete documents
program
  .command("mongo-delete <collection>")
  .option("-w, --where <json>", "Filter as JSON string")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Delete documents from a collection")
  .action(async (collection, opts) => {
    const cfg = await promptForMissingCredentials(getCfgOrDie(opts.db));
    const adapter = makeAdapter(cfg) as MongoAdapter;

    if (adapter.kind() !== "mongo") {
      console.error("Not a MongoDB connection");
      process.exit(1);
    }

    await adapter.connect();
    const filter = opts.where ? JSON.parse(opts.where) : {};
    await adapter.delete(collection, filter);
    console.log(`✅ Documents deleted from "${collection}"`);
    await adapter.close();
  });

// Drop collection
program
  .command("mongo-drop-collection <collection>")
  .option("-d, --db <name>", "Connection name", "default")
  .description("Drop a collection")
  .action(async (collection, opts) => {
    const cfg = await promptForMissingCredentials(getCfgOrDie(opts.db));
    const adapter = makeAdapter(cfg) as MongoAdapter;

    if (adapter.kind() !== "mongo") {
      console.error("Not a MongoDB connection");
      process.exit(1);
    }

    await adapter.connect();
    await adapter.dropCollection(collection);
    console.log(`✅ Collection "${collection}" dropped`);
    await adapter.close();
  });

program.parseAsync(process.argv);
