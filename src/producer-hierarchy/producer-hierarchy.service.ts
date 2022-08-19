import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Neo4jService } from '../neo4j/neo4j.service';
import * as path from 'path';

const csvWriter = require('csv-writer');

export interface ProducerHierarchyPayload {
  producerId: string;
  businessUnit: string;
  uplines: ProducerUplineRecord[];
}

export interface ProducerUplineRecord {
  id: string;
  contractCode: string;
  from: string;
  to: string;
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

const FROM_YEARS: string[] = [
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
];
const TO_YEARS: string[] = ['2023', '2025', '2030'];

@Injectable()
export class ProducerHierarchyService {
  private readonly logger = new Logger(ProducerHierarchyService.name);
  uplineIdStart: number = 1050000000;

  constructor(private readonly neo4jService: Neo4jService) {}

  dirPath = path.join(__dirname, '../../');

  writer = csvWriter.createObjectCsvWriter({
    path: path.resolve(this.dirPath, 'hierarchy-seed.csv'),
    header: [
      { id: 'fromBpId', title: 'From BpId' },
      { id: 'uplineId', title: 'Upline ID' },
      { id: 'relationshipType', title: 'Relationship Type' },
      { id: 'contractCode', title: 'Contract Code' },
      { id: 'from', title: 'From' },
      { id: 'to', title: 'To' },
    ],
  });

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

    const uplines = producerHierarchyPayload.uplines;
    const producerUplineParams:object[] = [];
    const agencyUplineParams:object[] = [];
    await this.addUplines('Producer', producerId, uplines, producerUplineParams, agencyUplineParams);
    await this.neo4jService.batchWrite(
        producerUplineParams, agencyUplineParams
    );
  }

  async deleteAllData() {
    await this.neo4jService.write('MATCH (n) DETACH DELETE n', [{}]);
  }

  async addUplines(
    fromType: string,
    fromBpId: string,
    uplines: ProducerUplineRecord[],
    producerUplineParams: object[],
    agencyUplineParams: object[]
  ) {
    if (!uplines || uplines.length === 0) {
      return;
    }
    for (const upline of uplines) {
      if('Producer' === fromType) {
        producerUplineParams.push({
          fromType: fromType,
          fromBpId: fromBpId,
          uplineId: upline.id,
          relationshipType: upline.relationshipType,
          contractCode: upline.contractCode,
          from: upline.from,
          to: upline.to,
        });
      } else {
        agencyUplineParams.push({
          fromType: fromType,
          fromBpId: fromBpId,
          uplineId: upline.id,
          relationshipType: upline.relationshipType,
          contractCode: upline.contractCode,
          from: upline.from,
          to: upline.to,
        });
      }
      // const record = {
      //   fromBpId: fromBpId,
      //   uplineId: upline.id,
      //   relationshipType: upline.relationshipType,
      //   contractCode: upline.contractCode,
      //   from: upline.from,
      //   to: upline.to,
      // };
      // await this.writer.writeRecords([record]);
      await this.addUplines('Upline', upline.id, upline.uplines, producerUplineParams, agencyUplineParams);
    }
  }

  async deleteHierarchy(producerId: string) {
    await this.neo4jService.write(
      `MATCH (p:Producer {id:$producerId})
              DETACH DELETE p`,
      [{
        producerId: producerId,
      }],
    );
  }

  async seedData(count = 100): Promise<void> {
    const startTime = performance.now();
    this.uplineIdStart = 1050000000;
    await this.deleteAllData();
    let producerIdStart = 1000000000;
    const bu = 'MMFACareer';
    this.logger.log(`__direname -  ${this.dirPath}`);
    for (let i = 0; i < count; i++) {
      const producerId = producerIdStart++;
      const payload: ProducerHierarchyPayload = {
        producerId: producerId.toString(),
        businessUnit: bu,
        uplines: this.generateSeedUplines(undefined ),
      };
      this.logger.log(`Adding hierarchy for producer ${producerId}`);
      await this.addHierarchy(payload);
    }
    const endTime = performance.now();
    this.logger.log(`Total time - ${endTime - startTime} milliseconds`);
  }

  generateSeedUplines(depth: number | undefined): ProducerUplineRecord[] {
    const uplines: ProducerUplineRecord[] = [];
    if (depth !== undefined && depth <= 0) {
      return uplines;
    }
    const uplineCount = this.generateRandomUplineCount(5);
    for (let i = 0; i < uplineCount; i++) {
      let uplineDepth = depth;
      if (depth === undefined) {
        uplineDepth = this.generateRandomUplineDepth(5);
      }
      uplineDepth--;
      const uplineId = this.uplineIdStart++;
      const fromYear = this.getRandomFromYear();
      const fromDateStr = fromYear + '-08-07T00:00:00Z';
      const toDateStr = this.getRandomToYear(fromYear) + '-08-07T00:00:00Z';
      const uplineRecord: ProducerUplineRecord = {
        id: uplineId.toString(),
        contractCode: 'Z202',
        from: fromDateStr,
        to: toDateStr,
        relationshipType: this.getRandomRelationshipType(),
        uplines: this.generateSeedUplines(uplineDepth),
      };
      uplines.push(uplineRecord);
    }
    return uplines;
  }

  generateRandomUplineCount(max: number): number {
    return Math.floor(Math.random() * max) + 1;
  }

  generateRandomUplineDepth(max: number): number {
    return Math.floor(Math.random() * (max + 1));
  }

  getRandomFromYear(): string {
    const idx = Math.floor(Math.random() * FROM_YEARS.length);
    const year = FROM_YEARS[idx];
    return year;
  }

  getRandomToYear(fromYear: string): string {
    const idx = Math.floor(Math.random() * 20) + 1;
    if (idx % 5 === 0) {
      const from = parseInt(fromYear);
      return (from + idx).toString();
    }
    return '9999';
  }

  getRandomRelationshipType(): string {
    const idx = Math.floor(Math.random() * 20) + 1;
    if (idx <= 3) {
      return 'CAN_PROXY';
    } else {
      return 'CAN_SELL_UNDER';
    }
  }
}
