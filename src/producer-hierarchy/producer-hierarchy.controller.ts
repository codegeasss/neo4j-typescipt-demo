import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  HierarchyResponse,
  ProducerHierarchyPayload,
  ProducerHierarchyService,
} from './producer-hierarchy.service';

@Controller('producer-hierarchy')
export class ProducerHierarchyController {
  constructor(
    private readonly producerHierarchyService: ProducerHierarchyService,
  ) {}

  @Get('/:producerId')
  async getHierarchy(
    @Param('producerId') producerId: string,
    @Query('asOfDate') asOfDate: string,
    @Query('relationshipType') relationshipType: string,
    @Query('maxDepth') maxDepth: number,
  ): Promise<HierarchyResponse> {
    if (!asOfDate) {
      asOfDate = new Date().toISOString();
    }
    return this.producerHierarchyService.getHierarchy(
      producerId,
      asOfDate,
      relationshipType,
      maxDepth,
    );
  }

  @Post('/')
  async addHierarchy(
    @Request() request,
    @Body() producerHierarchyPayload: ProducerHierarchyPayload,
  ): Promise<string> {
    return this.producerHierarchyService.addHierarchy(producerHierarchyPayload);
  }
}
