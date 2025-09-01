import { Pool } from "pg";
import { DbAdapter, PostgresConfig, SqlCapable } from "../types";

export class PostgresAdapter implements DbAdapter, SqlCapable {
  private pool!: Pool;
  constructor(private cfg: PostgresConfig) {}

  kind() {
    return "postgres" as const;
  }

  async connect() {
    this.pool = new Pool({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      ssl: this.cfg.ssl ? { rejectUnauthorized: false } : undefined,
    });
    await this.pool.query("SELECT 1");
  }

  async query(sql: string, params: any[] = []) {
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async listTables(): Promise<string[]> {
    const q = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type='BASE TABLE'
      ORDER BY table_name;
    `;
    const { rows } = await this.pool.query(q);
    return rows.map((r) => r.table_name);
  }

  async close() {
    await this.pool.end();
  }
}
