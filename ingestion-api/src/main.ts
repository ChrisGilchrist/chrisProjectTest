import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend access
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Quix Search API listening on port ${port}`);
  console.log(`📍 Search endpoint: http://localhost:${port}/search?q=your-query`);
}

bootstrap();
