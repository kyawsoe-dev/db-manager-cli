#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config";
import { makeAdapter } from "./factory";
import { SqlCapable } from "./types";

const program = new Command();
program
  .name("dbman")
  .description("Multi-DB manager CLI (Postgres, MySQL, MongoDB)")
  .version("0.1.0");

function getCfgOrDie(name: string) {
  const cfgs = loadConfig();
  const cfg = cfgs[name];
  if (!cfg)
    throw new Error(
      `Unknown connection "${name}". Use "dbman list" to see available names.`
    );
  return cfg;
}

// List configured connections
program
  .command("list")
  .description("List configured connections")
  .action(() => {
    const cfgs = loadConfig();
    const rows = Object.values(cfgs).map((c) => ({
      name: c.name,
      type: c.type,
    }));
    if (!rows.length) {
      console.log("No connections in .dbman.yaml");
      return;
    }
    console.table(rows);
  });

// Test connection
program
  .command("test")
  .option("-d, --db <name>", "connection name", "default")
  .description("Test a connection")
  .action(async (opts) => {
    const cfg = getCfgOrDie(opts.db);
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

// Run a SQL query (default DB)
program
  .command("query")
  .requiredOption("-q, --query <sql>", "SQL to execute")
  .description("Run a SQL query on default DB")
  .action(async (opts) => {
    const cfg = loadConfig()["default"];
    const adapter = makeAdapter(cfg);
    await adapter.connect();
    const sqlAdapter = adapter as unknown as SqlCapable;
    const rows = await sqlAdapter.query(opts.query, []);
    console.table(rows);
    await adapter.close();
  });

// Query only (default DB)
program
  .argument("[sql]", "SQL to execute")
  .option("-d, --db <name>", "connection name", "default")
  .option("--json", "Print raw JSON instead of table", false)
  .description("Run a SQL query (default DB if -d not provided)")
  .action(async (sql: string, opts) => {
    if (!sql) {
      console.error("No SQL provided");
      process.exit(1);
      return;
    }
    const cfg = getCfgOrDie(opts.db);
    const adapter = makeAdapter(cfg);

    if (adapter.kind() === "mongo") {
      console.error("Use Mongo commands for MongoDB");
      process.exit(1);
      return;
    }

    try {
      await adapter.connect();
      const sqlAdapter = adapter as unknown as SqlCapable;
      const rows = await sqlAdapter.query(sql, []);
      if (opts.json) console.log(JSON.stringify(rows, null, 2));
      else console.table(rows);
    } finally {
      await adapter.close().catch(() => {});
    }
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
