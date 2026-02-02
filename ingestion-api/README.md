# Quix Search API

A NestJS-based semantic search API for Quix documentation using Qdrant vector database and Transformers.js for embeddings.

## Features

- 🔍 Semantic search endpoint `/search?q=<query>`
- 🧠 Uses MiniLM embeddings for fast, accurate results
- 📊 Returns ranked results with title, snippet, URL, and score
- 🚀 Built with NestJS for production-ready architecture
- ⚡ Transformers.js for efficient embeddings in Node.js
- 🌐 CORS enabled for frontend integration

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

The `.env` file contains the configuration:

```env
QDRANT_URL=https://qdrant-qdrant-v1-8-3-quixdev-chrisprojecttest-env1.deployments-dev.quix.io
QDRANT_COLLECTION=quix_docs
MODEL_NAME=Xenova/all-MiniLM-L6-v2
PORT=3000
```

### 3. Start the API

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Endpoints

### Search Documentation

```
GET /search?q=<query>&limit=<number>
```

**Parameters:**
- `q` (required): Search query string
- `limit` (optional): Number of results to return (1-20, default: 5)

**Example:**

```bash
curl "http://localhost:3000/search?q=streams&limit=10"
```

**Response:**

```json
{
  "query": "streams",
  "count": 5,
  "results": [
    {
      "title": "Streams Overview",
      "snippet": "Streams are the core abstraction in Quix for handling real-time data...",
      "url": "https://docs.quix.io/streams/overview.md",
      "score": 0.9123
    }
  ]
}
```

### Health Check

```
GET /search/health
```

Returns the API health status.
