import logging
import sys
import time
import traceback
import uuid
import os
from pathlib import Path
import signal

# -------------------------------
# Logging
# -------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("ingestion")

# -------------------------------
# Configuration
# -------------------------------
# Try multiple paths for docs (container vs local development)
if os.path.exists("./quix-docs-main/docs"):
    DEFAULT_DOCS_ROOT = "./quix-docs-main/docs"
elif os.path.exists("./ingestion/quix-docs-main/docs"):
    DEFAULT_DOCS_ROOT = "./ingestion/quix-docs-main/docs"
else:
    DEFAULT_DOCS_ROOT = "./quix-docs-main/docs"  # Fallback

DOCS_ROOT = os.environ.get("DOCS_ROOT", DEFAULT_DOCS_ROOT)
COLLECTION = os.environ.get("QDRANT_COLLECTION", "quix_docs")
QDRANT_URL = os.environ.get(
    "QDRANT_URL",
    "http://qdrant:6333"
)
MODEL_NAME = os.environ.get("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")

# -------------------------------
# Utility Functions
# -------------------------------
def find_markdown_files(root):
    root_path = Path(root)
    return list(root_path.rglob("*.md"))

def read_markdown(md_file):
    with open(md_file, "r", encoding="utf-8") as f:
        return f.read()

def markdown_to_text(md_content):
    import re
    text = re.sub(r"#+ ", "", md_content)  # remove headings
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)  # remove links but keep text
    return text

def chunk_text(text, chunk_size=500):
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunks.append(" ".join(words[i:i+chunk_size]))
    return chunks

def build_docs_url(md_file):
    try:
        relative = md_file.relative_to(DOCS_ROOT)
    except ValueError:
        relative = md_file.name
    return f"https://docs.quix.io/{relative}"

# -------------------------------
# Graceful Shutdown
# -------------------------------
stop_signal = False

def handle_stop_signal(signum, frame):
    global stop_signal
    log.info("🛑 Stop signal received, shutting down...")
    stop_signal = True

signal.signal(signal.SIGINT, handle_stop_signal)
signal.signal(signal.SIGTERM, handle_stop_signal)

# -------------------------------
# Main Ingestion Function
# -------------------------------
def main():
    try:
        log.info("🚀 Ingestion service starting")

        log.info("📦 Importing dependencies")
        from sentence_transformers import SentenceTransformer
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct, Distance, VectorParams

        log.info(f"🧠 Loading embedding model: {MODEL_NAME}")
        model = SentenceTransformer(MODEL_NAME)
        log.info("✅ Model loaded")

        log.info(f"🔌 Connecting to Qdrant at {QDRANT_URL}")
        client = QdrantClient(url=QDRANT_URL, timeout=180)
        log.info("✅ Connected to Qdrant")

        # Delete existing collection if it exists (to clear duplicates)
        try:
            collections = client.get_collections()
            collection_names = [c.name for c in collections.collections]
            log.info(f"📚 Qdrant has {len(collection_names)} collections")

            if COLLECTION in collection_names:
                log.info(f"🗑️  Deleting existing collection: {COLLECTION}")
                client.delete_collection(collection_name=COLLECTION)
                log.info(f"✅ Collection {COLLECTION} deleted")

            # Create fresh collection
            log.info(f"📦 Creating collection: {COLLECTION}")
            client.create_collection(
                collection_name=COLLECTION,
                vectors_config=VectorParams(
                    size=384,  # MiniLM-L6-v2 embedding dimension
                    distance=Distance.COSINE
                )
            )
            log.info(f"✅ Collection {COLLECTION} created")
        except Exception as e:
            log.error(f"❌ Collection setup failed: {e}")
            raise

        log.info(f"📂 Scanning docs in {DOCS_ROOT}")
        md_files = find_markdown_files(DOCS_ROOT)
        log.info(f"📄 Found {len(md_files)} markdown files")

        for idx, md_file in enumerate(md_files):
            if stop_signal:
                log.info("🛑 Stopping ingestion loop due to signal")
                break

            log.info(f"➡️ Processing {idx+1}/{len(md_files)}: {md_file}")

            raw_md = read_markdown(md_file)
            text = markdown_to_text(raw_md)
            chunks = chunk_text(text)

            log.info(f"✂️ {len(chunks)} chunks created")

            if not chunks:
                continue

            log.info(f"🔢 Starting encoding for {len(chunks)} chunks...")
            try:
                vectors = model.encode(
                    chunks,
                    batch_size=16,
                    show_progress_bar=False
                )
                log.info(f"✅ Encoding complete, got {len(vectors)} vectors")
            except Exception as e:
                log.error(f"❌ Encoding failed: {e}")
                raise

            log.info(f"📦 Building {len(chunks)} point structures...")
            points = []
            for i, chunk in enumerate(chunks):
                points.append(
                    PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vectors[i].tolist(),
                        payload={
                            "title": md_file.stem,
                            "text": chunk,
                            "source_path": str(md_file),
                            "url": build_docs_url(md_file),
                        }
                    )
                )
            log.info(f"✅ Built {len(points)} points")

            # Batch upsert with retry logic
            batch_size = 16
            num_batches = (len(points)-1)//batch_size+1
            log.info(f"📤 Upserting {len(points)} points in {num_batches} batches...")
            for i in range(0, len(points), batch_size):
                batch = points[i:i+batch_size]

                # Retry upsert with exponential backoff
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        client.upsert(collection_name=COLLECTION, points=batch)
                        log.info(f"✅ Upserted batch {i//batch_size+1}/{(len(points)-1)//batch_size+1}")
                        break
                    except Exception as e:
                        if attempt < max_retries - 1:
                            wait_time = 2 ** attempt
                            log.warning(f"⚠️  Upsert failed (attempt {attempt+1}/{max_retries}), retrying in {wait_time}s... Error: {e}")
                            time.sleep(wait_time)
                        else:
                            log.error(f"❌ Upsert failed after {max_retries} attempts")
                            raise

        log.info("🎉 Ingestion complete")

    except Exception as e:
        log.error("🔥 FATAL ERROR")
        log.error(str(e))
        traceback.print_exc()
        raise

# -------------------------------
# Entry Point
# -------------------------------
if __name__ == "__main__":
    main()

    log.info("🛑 Ingestion finished — keeping service alive")
    try:
        while not stop_signal:
            time.sleep(60)
    except KeyboardInterrupt:
        log.info("🛑 KeyboardInterrupt received, exiting")
