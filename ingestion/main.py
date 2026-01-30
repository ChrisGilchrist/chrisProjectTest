import os
import uuid
import hashlib
import json
import re
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

# ----------------------------
# Config
# ----------------------------
DOCS_DIR = "./quix-docs"          # Local clone of https://github.com/quixio/quix-docs
COLLECTION_NAME = "quix_docs"
QDRANT_URL = "http://localhost:6333"
HASHES_FILE = "file_hashes.json"  # Stores hashes of files to track changes

CHUNK_SIZE = 500
CHUNK_OVERLAP = 80
MODEL_NAME = "intfloat/e5-base-v2"

# ----------------------------
# Helpers
# ----------------------------
def read_markdown(path: Path) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def clean_text(text: str) -> str:
    text = re.sub(r"```.*?```", "", text, flags=re.S)  # Remove code blocks
    text = re.sub(r"`([^`]*)`", r"\1", text)           # Remove inline code
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def chunk_text(text: str, chunk_size: int, overlap: int):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = words[start:end]
        chunks.append(" ".join(chunk))
        start = end - overlap
    return chunks

def normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / norms

def file_hash(path: Path) -> str:
    """Compute MD5 hash of file content"""
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()

def load_hashes() -> dict:
    if os.path.exists(HASHES_FILE):
        with open(HASHES_FILE, "r") as f:
            return json.load(f)
    return {}

def save_hashes(hashes: dict):
    with open(HASHES_FILE, "w") as f:
        json.dump(hashes, f, indent=2)

# ----------------------------
# Main ingestion
# ----------------------------
def main():
    print("🔌 Connecting to Qdrant...")
    qdrant = QdrantClient(url=QDRANT_URL)

    # Create collection if missing
    existing_collections = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION_NAME not in existing_collections:
        print(f"📦 Creating Qdrant collection '{COLLECTION_NAME}'...")
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=768,
                distance=Distance.COSINE
            )
        )

    print("🤖 Loading E5 embedding model...")
    model = SentenceTransformer(MODEL_NAME)

    # Load previous file hashes
    prev_hashes = load_hashes()
    new_hashes = {}

    points = []

    print("📚 Reading docs...")
    for path in Path(DOCS_DIR).rglob("*.md"):
        rel_path = str(path.relative_to(DOCS_DIR))
        new_hashes[rel_path] = file_hash(path)

        # Check if file changed
        if rel_path in prev_hashes and prev_hashes[rel_path] == new_hashes[rel_path]:
            continue  # Skip unchanged file

        raw_text = read_markdown(path)
        clean = clean_text(raw_text)
        if not clean:
            continue

        chunks = chunk_text(clean, CHUNK_SIZE, CHUNK_OVERLAP)
        passages = [f"passage: {c}" for c in chunks]  # E5 requires 'passage:' prefix

        embeddings = model.encode(passages, show_progress_bar=False)
        embeddings = normalize(np.array(embeddings))

        for i, (chunk, vector) in enumerate(zip(chunks, embeddings)):
            chunk_id = f"{rel_path}::chunk_{i}"  # deterministic ID
            points.append(PointStruct(
                id=chunk_id,
                vector=vector.tolist(),
                payload={
                    "title": path.stem,
                    "url": f"/docs/{path.stem}",
                    "text": chunk,
                    "source": rel_path
                }
            ))

    if points:
        print(f"📤 Uploading {len(points)} chunks to Qdrant...")
        qdrant.upsert(collection_name=COLLECTION_NAME, points=points)
    else:
        print("⚡ No changes detected, nothing to upload.")

    # Save new hashes
    save_hashes(new_hashes)
    print("✅ Ingestion complete!")

if __name__ == "__main__":
    main()
