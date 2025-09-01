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
    if (name === "default") {
      console.error("❌ Cannot delete the default connection!");
      process.exit(1);
    }

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

program.parseAsync(process.argv);
