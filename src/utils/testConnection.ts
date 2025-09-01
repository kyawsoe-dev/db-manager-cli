import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";
import { AnyDbConfig } from "../types";

export async function testConnection(cfg: AnyDbConfig): Promise<void> {
  if (cfg.type === "postgres") {
    const client = new PgClient({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    });
    await client.connect();
    await client.end();
  } else if (cfg.type === "mysql") {
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    });
    await conn.end();
  } else if (cfg.type === "mongo") {
    const client = new MongoClient(cfg.uri);
    await client.connect();
    await client.close();
  }
}
