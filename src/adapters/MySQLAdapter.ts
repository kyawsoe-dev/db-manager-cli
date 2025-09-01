import mysql from "mysql2/promise";
import { DbAdapter, MySQLConfig, SqlCapable } from "../types";

export class MySQLAdapter implements DbAdapter, SqlCapable {
  private pool!: mysql.Pool;
  constructor(private cfg: MySQLConfig) {}

  kind() {
    return "mysql" as const;
  }

  async connect() {
    this.pool = mysql.createPool({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
    });
    await this.pool.query("SELECT 1");
  }

  async query(sql: string, params: any[] = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  async listTables(): Promise<string[]> {
    const [rows] = await this.pool.query("SHOW TABLES");
    const firstKey =
      rows && typeof rows[0] === "object" ? Object.keys(rows[0])[0] : null;
    return firstKey ? (rows as any[]).map((r) => r[firstKey]) : [];
  }

  async close() {
    await this.pool.end();
  }
}
