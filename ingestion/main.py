import logging
import sys
import time
import traceback

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    stream=sys.stdout,
)

log = logging.getLogger("ingestion")

def main():
    try:
        log.info("🚀 Ingestion service starting")

        log.info("📦 Importing dependencies")
        from sentence_transformers import SentenceTransformer
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        log.info("🧠 Loading embedding model")
        model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L6-v2"
        )
        log.info("✅ Model loaded")

        log.info("🔌 Connecting to Qdrant")
        client = QdrantClient(
            url=QDRANT_URL,
            timeout=30
        )
        log.info("✅ Connected to Qdrant")

        log.info(f"📂 Scanning docs in {DOCS_ROOT}")
        md_files = find_markdown_files(DOCS_ROOT)
        log.info(f"📄 Found {len(md_files)} markdown files")

        for idx, md_file in enumerate(md_files):
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

            client.upsert(
                collection_name=COLLECTION,
                points=points
            )

            log.info(f"✅ Upserted {len(points)} points")

        log.info("🎉 Ingestion complete")

    except Exception as e:
        log.error("🔥 FATAL ERROR")
        log.error(str(e))
        traceback.print_exc()
        raise


if __name__ == "__main__":
    main()

    # KEEP THE SERVICE ALIVE
    log.info("🛑 Ingestion finished — keeping service alive")
    while True:
        time.sleep(60)
