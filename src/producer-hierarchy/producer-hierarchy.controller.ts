import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
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

  @Get('/producer/:producerId')
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

  @Post('/producer')
  async addHierarchy(
    @Request() request,
    @Body() producerHierarchyPayload: ProducerHierarchyPayload,
  ): Promise<object> {
    try {
      await this.producerHierarchyService.addHierarchy(
        producerHierarchyPayload,
      );
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
    return {
      statusCode: HttpStatus.OK,
      message: `Successfully added hierarchy data for ${producerHierarchyPayload.producerId}`,
    };
  }

  @Delete('producer/:producerId')
  async deleteHierarchy(
    @Param('producerId') producerId: string,
  ): Promise<object> {
    try {
      await this.producerHierarchyService.deleteHierarchy(producerId);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
    return {
      statusCode: HttpStatus.OK,
      message: `Successfully deleted hierarchy data for ${producerId}`,
    };
  }

  @Post('/seed-data')
  async seedData(@Body() payload: object): Promise<object> {
    try {
      await this.producerHierarchyService.seedData(payload['count']);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
    return {
      statusCode: HttpStatus.OK,
      message: `Successfully seeded hierarchy data`,
    };
  }

  @Get('/percentile')
  async getHierarchyPercentile(
      @Query('count') count: number,
      @Query('percentile') percentile: number,
  ): Promise<number> {
    return this.producerHierarchyService.getHierarchyPercentile(
        count,
        percentile
    );
  }
}
