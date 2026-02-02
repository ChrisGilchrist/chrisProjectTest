import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private client: QdrantClient;
  private model: any;
  private collection: string;
  private modelReady = false;

  constructor() {
    this.collection = process.env.QDRANT_COLLECTION || 'quix_docs';
    const url = process.env.QDRANT_URL || 'http://qdrant:6333';

    if (!url) {
      throw new Error('QDRANT_URL not set in environment');
    }

    this.logger.log(`🔌 Connecting to Qdrant at ${url}`);
    this.client = new QdrantClient({ url });
  }

  async onModuleInit() {
    const modelName = process.env.MODEL_NAME || 'Xenova/all-MiniLM-L6-v2';
    this.logger.log(`🧠 Loading embedding model: ${modelName}`);

    try {
      // Load the model using Transformers.js
      this.model = await pipeline('feature-extraction', modelName);
      this.modelReady = true;
      this.logger.log('✅ Model loaded and ready');
    } catch (error) {
      this.logger.error('❌ Failed to load model:', error);
      throw error;
    }
  }

  private async embed(text: string): Promise<number[]> {
    if (!this.modelReady) {
      throw new Error('Model not ready yet');
    }

    // Generate embeddings
    const output = await this.model(text, { pooling: 'mean', normalize: true });

    // Convert to array
    return Array.from(output.data);
  }

  async search(query: string, topK = 5) {
    this.logger.log(`🔍 Searching for: "${query}"`);

    // Embed the query
    const vector = await this.embed(query);

    this.logger.log(`📊 Vector size: ${vector.length}`);

    // Search Qdrant
    const results = await this.client.search(this.collection, {
      vector: vector,
      limit: topK,
      with_payload: true,
    });

    this.logger.log(`✅ Found ${results.length} results`);

    // Map to a simpler JSON format
    return results.map(r => ({
      title: r.payload?.title || 'Untitled',
      snippet: this.truncateText(r.payload?.text as string, 200),
      url: r.payload?.url || '',
      score: r.score,
    }));
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
}
