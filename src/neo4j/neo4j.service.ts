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
    params: Record<string, any>[],
    database?: string,
  ): Promise<void> {
    const session = this.getWriteSession(database);
    for(const param of params) {
      await session.run(cypher, param);
    }
  }

  async writeHierarchyBatch(producerUplines: object[], agencyUplines: object[], database?: string,) {
    const session = this.getWriteSession(database);
    const canSellUnderProducerUplines = producerUplines.filter((p) => {
      return p['relationshipType'] === 'CAN_SELL_UNDER';
    });
    const canSellUnderAgencyUplines = agencyUplines.filter((p) => {
      return p['relationshipType'] === 'CAN_SELL_UNDER';
    });
    const canSellUnderProducerQuery = `UNWIND $canSellUnderProducerUplines as node 
    MERGE (f:Producer {id: node.fromBpId}) 
    MERGE (t:Upline {id: node.uplineId}) 
    MERGE (f)-[r:CAN_SELL_UNDER {contractCode: node.contractCode, from: node.from, to: node.to}]->(t) 
    ON CREATE SET r.createdAt = datetime() ON MATCH SET r.updatedAt = datetime()`;
    await session.run(canSellUnderProducerQuery, {canSellUnderProducerUplines : canSellUnderProducerUplines});
    const canSellUnderAgencyQuery = `UNWIND $canSellUnderAgencyUplines as node 
    MERGE (f:Upline {id: node.fromBpId}) 
    MERGE (t:Upline {id: node.uplineId}) 
    MERGE (f)-[r:CAN_SELL_UNDER {contractCode: node.contractCode, from: node.from, to: node.to}]->(t) 
    ON CREATE SET r.createdAt = datetime() ON MATCH SET r.updatedAt = datetime()`;
    await session.run(canSellUnderAgencyQuery, {canSellUnderAgencyUplines : canSellUnderAgencyUplines});
    const canProxyProducerUplines = producerUplines.filter((p) => {
      return p['relationshipType'] === 'CAN_PROXY';
    });
    const canProxyAgencyUplines = agencyUplines.filter((p) => {
      return p['relationshipType'] === 'CAN_PROXY';
    });
    const canProxyProducerQuery = `UNWIND $canProxyProducerUplines as node 
    MERGE (f:Producer {id: node.fromBpId}) 
    MERGE (t:Upline {id: node.uplineId}) 
    MERGE (f)-[r:CAN_PROXY {contractCode: node.contractCode, from: node.from, to: node.to}]->(t) 
    ON CREATE SET r.createdAt = datetime() ON MATCH SET r.updatedAt = datetime()`;
    await session.run(canProxyProducerQuery, {canProxyProducerUplines : canProxyProducerUplines});
    const canProxyAgencyQuery = `UNWIND $canProxyAgencyUplines as node 
    MERGE (f:Upline {id: node.fromBpId}) 
    MERGE (t:Upline {id: node.uplineId}) 
    MERGE (f)-[r:CAN_PROXY {contractCode: node.contractCode, from: node.from, to: node.to}]->(t) 
    ON CREATE SET r.createdAt = datetime() ON MATCH SET r.updatedAt = datetime()`;
    await session.run(canProxyAgencyQuery, {canProxyAgencyUplines : canProxyAgencyUplines});
  }

  getConfig(): Neo4jConfig {
    return this.config;
  }
  getDriver(): Driver {
    return this.driver;
  }
}
