import { AnyDbConfig } from "./../types";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
export async function ensureDatabaseExists(cfg: AnyDbConfig) {
  if (cfg.type === "postgres") {
    const client = new PgClient({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: "postgres",
    });
    await client.connect();
    await client.query(`CREATE DATABASE "${cfg.database}"`);
    await client.end();
  } else if (cfg.type === "mysql") {
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\``);
    await conn.end();
  }
}
