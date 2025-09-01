export type DbKind = "postgres" | "mysql" | "mongo";

export interface BaseConfig {
  type: DbKind;
  name: string;
}

export interface PostgresConfig extends BaseConfig {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
}

export interface MySQLConfig extends BaseConfig {
  type: "mysql";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface MongoConfig extends BaseConfig {
  type: "mongo";
  uri: string;
  dbName: string;
}

export type AnyDbConfig = PostgresConfig | MySQLConfig | MongoConfig;

export interface SqlCapable {
  query(sql: string, params?: any[]): Promise<any>;
  listTables(): Promise<string[]>;
}

export interface DbAdapter {
  connect(): Promise<void>;
  close(): Promise<void>;
  kind(): DbKind;
}
