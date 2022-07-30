import { DynamicModule, Module } from '@nestjs/common';
import { Neo4jService } from './neo4j.service';
import { createDriver } from '../neo4j.utils';
import { Neo4jConfig } from '../neo4j-config.interface';
import { NEO4J_CONFIG, NEO4J_DRIVER } from '../neo4j.constants';

@Module({})
export class Neo4jModule {
  static forRoot(config: Neo4jConfig): DynamicModule {
    return {
      module: Neo4jModule,
      global: true,
      providers: [
        {
          provide: NEO4J_CONFIG,
          useValue: config,
        },
        {
          // Define a key for injection
          provide: NEO4J_DRIVER,
          // Inject NEO4J_OPTIONS defined above as the
          inject: [NEO4J_CONFIG],
          // Use the factory function created above to return the driver
          useFactory: async (config: Neo4jConfig) => createDriver(config),
        },
        Neo4jService,
      ],
      exports: [Neo4jService],
    };
  }
}
