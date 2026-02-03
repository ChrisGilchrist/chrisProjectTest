import express from 'express';
import { QdrantClient } from '@qdrant/js-client-rest';
import { pipeline } from '@xenova/transformers';

const app = express();
const port = process.env.PORT || 3000;

// Configuration
const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333';
const COLLECTION = process.env.QDRANT_COLLECTION || 'quix_docs';
const MODEL_NAME = process.env.MODEL_NAME || 'Xenova/all-MiniLM-L6-v2';

// State
let model = null;
let modelReady = false;
const qdrantClient = new QdrantClient({ url: QDRANT_URL });

// Initialize embedding model
async function initializeModel() {
  console.log(`🧠 Loading embedding model: ${MODEL_NAME}`);
  try {
    model = await pipeline('feature-extraction', MODEL_NAME);
    modelReady = true;
    console.log('✅ Model loaded and ready');
  } catch (error) {
    console.error('❌ Failed to load model:', error);
    throw error;
  }
}

// Generate embeddings
async function embed(text) {
  if (!modelReady) {
    throw new Error('Model not ready yet');
  }
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Clean markdown syntax from text
function cleanMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\|[^|]+\|/g, '')              // Remove table syntax
    .replace(/\*\*(.+?)\*\*/g, '$1')        // Remove bold
    .replace(/\*(.+?)\*/g, '$1')            // Remove italic
    .replace(/`(.+?)`/g, '$1')              // Remove code marks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text only
    .replace(/\s+/g, ' ')                   // Normalize whitespace
    .trim();
}

// Smart truncation at sentence boundaries
function smartTruncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;

  // Find last sentence boundary before maxLength
  const truncated = text.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('. ');
  const lastQuestion = truncated.lastIndexOf('? ');
  const lastExclamation = truncated.lastIndexOf('! ');
  const boundary = Math.max(lastPeriod, lastQuestion, lastExclamation);

  // Use sentence boundary if it's not too far back (within 70% of maxLength)
  if (boundary > maxLength * 0.7) {
    return text.slice(0, boundary + 1);
  }

  // Fallback: cut at last space to avoid mid-word truncation
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? text.slice(0, lastSpace) + '...' : text.slice(0, maxLength) + '...';
}

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/search/health', (req, res) => {
  res.json({
    status: 'ok',
    modelReady: modelReady,
    timestamp: new Date().toISOString(),
  });
});

// Search endpoint
app.get('/search', async (req, res) => {
  const query = req.query.q;
  const limit = parseInt(req.query.limit) || 5;

  // Validate query
  if (!query || query.trim() === '') {
    return res.status(400).json({
      error: 'Query parameter "q" is required',
    });
  }

  // Validate limit
  if (isNaN(limit) || limit < 1 || limit > 20) {
    return res.status(400).json({
      error: 'Limit must be between 1 and 20',
    });
  }

  try {
    console.log(`🔍 Searching for: "${query}"`);

    // Generate query embedding
    const vector = await embed(query);
    console.log(`📊 Vector size: ${vector.length}`);

    // Search Qdrant
    const results = await qdrantClient.search(COLLECTION, {
      vector: vector,
      limit: limit,
      with_payload: true,
    });

    console.log(`✅ Found ${results.length} results`);

    // Format results (Supabase-compatible format)
    const formattedResults = results.map(r => ({
      title: r.payload?.title || 'Untitled',
      subtitle: r.payload?.subtitle || null,
      description: r.payload?.description || smartTruncate(cleanMarkdown(r.payload?.text), 200),
      url: r.payload?.url || '',
      heading: r.payload?.heading || null,
      slug: r.payload?.slug || null,
      score: r.score,
    }));

    res.json({
      query,
      count: formattedResults.length,
      results: formattedResults,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      details: error.message,
    });
  }
});

// Start server
app.listen(port, async () => {
  console.log(`🚀 Quix Search API listening on port ${port}`);
  console.log(`📍 Search endpoint: http://localhost:${port}/search?q=your-query`);
  console.log(`🔌 Connecting to Qdrant at ${QDRANT_URL}`);

  // Initialize model in background
  initializeModel().catch(err => {
    console.error('Failed to initialize model:', err);
    process.exit(1);
  });
});
