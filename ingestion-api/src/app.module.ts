import { Module } from '@nestjs/common';
import { SearchModule } from './search/search.module.js';

@Module({
  imports: [SearchModule],
})
export class AppModule {}
