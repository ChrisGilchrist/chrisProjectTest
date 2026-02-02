import { Module } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchController } from './search.controller.js';

@Module({
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
