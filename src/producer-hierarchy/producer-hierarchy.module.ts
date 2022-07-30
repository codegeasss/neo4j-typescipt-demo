import { Module } from '@nestjs/common';
import { Neo4jModule } from '../neo4j/neo4j.module';
import { AppController } from '../app.controller';
import { ProducerHierarchyController } from './producer-hierarchy.controller';
import { AppService } from '../app.service';
import { ProducerHierarchyService } from './producer-hierarchy.service';
import { Neo4jService } from '../neo4j/neo4j.service';

@Module({
  controllers: [ProducerHierarchyController],
  providers: [ProducerHierarchyService],
})
export class ProducerHierarchyModule {}
