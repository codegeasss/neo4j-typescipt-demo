import { Inject, Injectable } from '@nestjs/common';
import { Driver, Result, session, Session } from 'neo4j-driver';
import { NEO4J_CONFIG, NEO4J_DRIVER } from '../neo4j.constants';
import { Neo4jConfig } from '../neo4j-config.interface';

@Injectable()
export class Neo4jService {
  constructor(
    @Inject(NEO4J_CONFIG) private readonly config: Neo4jConfig,
    @Inject(NEO4J_DRIVER) private readonly driver: Driver,
  ) {}

  getReadSession(database?: string): Session {
    return this.driver.session({
      database: database || this.config.database,
      defaultAccessMode: session.READ,
    });
  }
  getWriteSession(database?: string): Session {
    return this.driver.session({
      database: database || this.config.database,
      defaultAccessMode: session.WRITE,
    });
  }

  async read(
    cypher: string,
    params: Record<string, any>,
    database?: string,
  ): Promise<Result> {
    const session = this.getReadSession(database);
    return session.run(cypher, params);
  }

  async write(
    cypher: string,
    params: Record<string, any>,
    database?: string,
  ): Promise<Result> {
    const session = this.getWriteSession(database);
    return session.run(cypher, params);
  }

  getConfig(): Neo4jConfig {
    return this.config;
  }
  getDriver(): Driver {
    return this.driver;
  }
}
