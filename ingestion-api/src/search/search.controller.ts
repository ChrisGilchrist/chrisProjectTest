import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim() === '') {
      throw new HttpException(
        { error: 'Query parameter "q" is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const topK = limit ? parseInt(limit, 10) : 5;

    if (isNaN(topK) || topK < 1 || topK > 20) {
      throw new HttpException(
        { error: 'Limit must be between 1 and 20' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results = await this.searchService.search(query, topK);
      return {
        query,
        count: results.length,
        results,
      };
    } catch (error) {
      throw new HttpException(
        { error: 'Search failed', details: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
