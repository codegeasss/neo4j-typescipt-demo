import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';

export interface ProducerHierarchyPayload {
  producerId: string;
  businessUnit: string;
  uplines: ProducerUplineRecord[];
}

export interface ProducerUplineRecord {
  id: string;
  contractCode: string;
  from: Date;
  to: Date;
  relationshipType: string;
  uplines: ProducerUplineRecord[];
}

export class HierarchyUplineResponse {
  bpId: string;
  contractCode: string;
  from: Date;
  to: Date;
  uplines: HierarchyUplineResponse[];
  constructor(partial: Partial<HierarchyUplineResponse>) {
    Object.assign(this, partial);
  }
}

export class HierarchyResponse {
  producerBpId: string;
  uplines: HierarchyUplineResponse[];
  constructor(partial: Partial<HierarchyResponse>) {
    Object.assign(this, partial);
  }
}

@Injectable()
export class ProducerHierarchyService {
  constructor(private readonly neo4jService: Neo4jService) {}

  async getHierarchy(
    producerId: string,
    asOfDate: string,
    relationshipType: string,
    maxDepth: number,
  ): Promise<HierarchyResponse> {
    const data = await this.getHierarchyData(
      producerId,
      asOfDate,
      relationshipType,
      maxDepth,
    );
    const hierarchyResponse: HierarchyResponse = new HierarchyResponse({
      producerBpId: producerId,
      uplines: this.getUplines(data['parents']),
    });
    return hierarchyResponse;
  }

  getUplines(parents: object): HierarchyUplineResponse[] {
    const uplines: HierarchyUplineResponse[] = [];
    if (!parents || Object.keys(parents).length == 0) {
      return uplines;
    }
    for (const parentId of Object.keys(parents)) {
      const parent = parents[parentId];
      uplines.push(
        new HierarchyUplineResponse({
          bpId: parent['bpId'],
          contractCode: parent['contractCode'],
          from: parent['from'],
          to: parent['to'],
          uplines: this.getUplines(parent['parents']),
        }),
      );
    }
    return uplines;
  }

  async getHierarchyData(
    producerId: string,
    asOfDate: string,
    relationshipType: string,
    maxDepth: number,
  ): Promise<object> {
    const res = await this.neo4jService.read(
      `Match p = (a)-[r * 1..${maxDepth}]->(u)
            WHERE a.id = $producerId AND
            all(rel in r where rel.from <= $asOfDate AND
            rel.to >= $asOfDate AND type(rel) = $relationshipType)
            RETURN ID(a) as id, a.id as producerId, collect(p) as relationships`,
      {
        producerId: producerId,
        asOfDate: asOfDate,
        relationshipType: relationshipType,
      },
    );
    const data = {
      parents: {},
    };
    if (res.records.length === 0) {
      return data;
    }
    const relationships = res.records[0].get('relationships');
    for (const relationship of relationships) {
      const segments = relationship['segments'];
      let parents = data['parents'];
      for (const segment of segments) {
        const end = segment['end'];
        const endId = end['identity'];
        if (!(endId in parents)) {
          const relationshipProps = segment['relationship']['properties'];
          parents[endId] = {
            bpId: end['properties']['id'],
            contractCode: relationshipProps['contractCode'],
            from: relationshipProps['from'],
            to: relationshipProps['to'],
            parents: {},
          };
        }
        parents = parents[endId]['parents'];
      }
    }
    return data;
  }

  async addHierarchy(
    producerHierarchyPayload: ProducerHierarchyPayload,
  ): Promise<void> {
    const producerId = producerHierarchyPayload.producerId;

    await this.neo4jService.write(
      `MERGE (p:Producer {id: $producerId}) RETURN p`,
      {
        producerId: producerId,
      },
    );

    const uplines = producerHierarchyPayload.uplines;
    await this.addUplines('Producer', producerId, uplines);
  }

  async addUplines(
    fromType: string,
    fromBpId: string,
    uplines: ProducerUplineRecord[],
  ) {
    if (!uplines || uplines.length === 0) {
      return;
    }
    for (const upline of uplines) {
      await this.neo4jService.write(
        `MATCH (f {id: $fromBpId}) MERGE (t:Upline {id: $uplineId}) MERGE (f)-[r:${upline.relationshipType} {contractCode: $contractCode, from: $from, to: $to}]->(t) ON CREATE SET r.createdAt = datetime() ON MATCH SET r.updatedAt = datetime()`,
        {
          fromType: fromType,
          fromBpId: fromBpId,
          uplineId: upline.id,
          contractCode: upline.contractCode,
          from: upline.from,
          to: upline.to,
        },
      );
      await this.addUplines('Upline', upline.id, upline.uplines);
    }
  }
}
