import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Neo4jModule } from './neo4j/neo4j.module';
import { Neo4jService } from './neo4j/neo4j.service';
import { ProducerHierarchyModule } from './producer-hierarchy/producer-hierarchy.module';
import * as dotenv from "dotenv";

dotenv.config();

@Module({
  imports: [
    Neo4jModule.forRoot({
      scheme: 'neo4j+s',
      host: process.env.DB_HOST,
      port: 7687,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    }),
    ProducerHierarchyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
