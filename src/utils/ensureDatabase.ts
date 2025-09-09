import { AnyDbConfig } from "./../types";
import { Client as PgClient } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";

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
  } else if (cfg.type === "mongo") {
    const client = new MongoClient(cfg.uri);
    await client.connect();
    const db = client.db(cfg.dbName);

    const existingCollections = await db
      .listCollections({ name: cfg.dbName })
      .toArray();
    if (existingCollections.length === 0) {
      await db.createCollection(cfg.dbName);
      console.log(
        `✅ MongoDB collection "${cfg.dbName}" created to ensure database exists`
      );
    } else {
      console.log(`✅ MongoDB database "${cfg.dbName}" already exists`);
    }

    await client.close();
  }
}
