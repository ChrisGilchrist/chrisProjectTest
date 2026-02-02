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
DOCS_ROOT = os.environ.get("DOCS_ROOT", "./ingestion/quix-docs-main/docs")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "quix_docs")
QDRANT_URL = os.environ.get(
    "QDRANT_URL",
    "https://qdrant-qdrant-v1-8-3-quixdev-chrisprojecttest-env1.deployments-dev.quix.io"
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
        from qdrant_client.models import PointStruct

        log.info(f"🧠 Loading embedding model: {MODEL_NAME}")
        model = SentenceTransformer(MODEL_NAME)
        log.info("✅ Model loaded")

        log.info(f"🔌 Connecting to Qdrant at {QDRANT_URL}")
        client = QdrantClient(url=QDRANT_URL, timeout=30)
        log.info("✅ Connected to Qdrant")

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

            vectors = model.encode(
                chunks,
                batch_size=16,
                show_progress_bar=False
            )

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

            # Batch upsert if needed (optional)
            batch_size = 64
            for i in range(0, len(points), batch_size):
                batch = points[i:i+batch_size]
                client.upsert(collection_name=COLLECTION, points=batch)
                log.info(f"✅ Upserted batch {i//batch_size+1}/{(len(points)-1)//batch_size+1}")

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
