import uuid
from pathlib import Path

import numpy as np
import torch
from transformers import AutoTokenizer, AutoModel
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
import markdown
from bs4 import BeautifulSoup

# =========================
# CONFIG
# =========================

DOCS_ROOT = "./quix-docs-main/docs"
COLLECTION = "quix_docs"
QDRANT_URL = "https://qdrant-qdrant-v1-8-3-quixdev-chrisprojecttest-env1.deployments-dev.quix.io"  # or http://localhost:6333

MODEL_NAME = "intfloat/e5-base-v2"

# =========================
# MODEL SETUP (E5)
# =========================

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
model.eval()

def embed_texts(texts: list[str]) -> np.ndarray:
    with torch.no_grad():
        encoded = tokenizer(
            texts,
            padding=True,
            truncation=True,
            return_tensors="pt"
        )

        output = model(**encoded)
        token_embeddings = output.last_hidden_state
        attention_mask = encoded["attention_mask"]

        mask = attention_mask.unsqueeze(-1).expand(token_embeddings.size())
        summed = torch.sum(token_embeddings * mask, dim=1)
        counts = torch.clamp(mask.sum(dim=1), min=1e-9)

        embeddings = summed / counts
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

    return embeddings.cpu().numpy()

# =========================
# DOC HELPERS
# =========================

def find_markdown_files(root: str) -> list[Path]:
    return list(Path(root).rglob("*.md"))

def read_markdown(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def markdown_to_text(md: str) -> str:
    html = markdown.markdown(md)
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(" ", strip=True)

def chunk_text(text: str, max_chars=800) -> list[str]:
    chunks = []
    current = ""

    for sentence in text.split(". "):
        if len(current) + len(sentence) > max_chars:
            chunks.append(current.strip())
            current = sentence
        else:
            current += ". " + sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks

def build_docs_url(path: Path) -> str:
    rel = path.relative_to(DOCS_ROOT).with_suffix("")
    return f"https://quix.io/docs/{rel.as_posix()}"

# =========================
# QDRANT
# =========================

client = QdrantClient(url=QDRANT_URL)

# =========================
# INGESTION
# =========================

md_files = find_markdown_files(DOCS_ROOT)
print(f"Found {len(md_files)} markdown files")

for md_file in md_files:
    raw_md = read_markdown(md_file)
    text = markdown_to_text(raw_md)
    chunks = chunk_text(text)

    if not chunks:
        continue

    prefixed_chunks = [f"passage: {c}" for c in chunks]
    vectors = embed_texts(prefixed_chunks)

    points = []
    for i, chunk in enumerate(chunks):
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vectors[i],
                payload={
                    "title": md_file.stem,
                    "text": chunk,
                    "url": build_docs_url(md_file),
                    "source_path": str(md_file),
                }
            )
        )

    client.upsert(
        collection_name=COLLECTION,
        points=points
    )

    print(f"Ingested {md_file}")

print("✅ Ingestion complete")
