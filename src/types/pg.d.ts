declare module "pg" {
  export interface PoolClient {
    query(sql: string): Promise<unknown>;
    release(): void;
  }

  export class Pool {
    constructor(config?: { connectionString?: string; max?: number });
    connect(): Promise<PoolClient>;
  }
}
