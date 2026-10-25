declare module "pg" {
  export interface QueryConfig {
    text: string;
    values?: unknown[];
  }

  export interface PoolClient {
    query(sql: string | QueryConfig, values?: unknown[]): Promise<unknown>;
    release(): void;
  }

  export class Pool {
    constructor(config?: { connectionString?: string; max?: number });
    connect(): Promise<PoolClient>;
  }

  export class Client {
    constructor(config?: { connectionString?: string });
    connect(): Promise<void>;
    query(sql: string | QueryConfig, values?: unknown[]): Promise<unknown>;
    end(): Promise<void>;
  }
}
