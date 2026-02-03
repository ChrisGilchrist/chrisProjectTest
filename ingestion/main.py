import logging
import sys
import time
import traceback
import uuid
import os
import re
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

DOCS_ROOT = Path(os.getenv("DOCS_ROOT", DEFAULT_DOCS_ROOT))
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
COLLECTION = os.getenv("QDRANT_COLLECTION", "quix_docs")
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")

log.info(f"Configuration:")
log.info(f"  DOCS_ROOT: {DOCS_ROOT}")
log.info(f"  QDRANT_URL: {QDRANT_URL}")
log.info(f"  COLLECTION: {COLLECTION}")
log.info(f"  MODEL_NAME: {MODEL_NAME}")

# -------------------------------
# Helper Functions
# -------------------------------

def heading_to_slug(heading):
    """Convert heading to URL-safe slug: 'SSL Connections' → 'ssl-connections'"""
    if not heading:
        return None
    slug = heading.lower()
    slug = re.sub(r'[^\w\s-]', '', slug)  # Remove special chars
    slug = re.sub(r'[\s_]+', '-', slug)    # Replace spaces/underscores with hyphens
    slug = slug.strip('-')                  # Remove leading/trailing hyphens
    return slug

def build_docs_url(md_file, frontmatter_metadata, section_slug=None):
    """Build URL using frontmatter metadata for blog posts, file path for regular docs"""
    try:
        relative = md_file.relative_to(DOCS_ROOT)
        relative_str = str(relative)

        # Blog posts use date-based URLs
        if 'blog/posts' in relative_str and frontmatter_metadata:
            date = frontmatter_metadata.get('date')
            slug = frontmatter_metadata.get('slug')
            if date and slug:
                date_str = str(date).replace('-', '/')
                base_url = f"https://quix.io/docs/blog/{date_str}/{slug}.html"
                return base_url + (f"#{section_slug}" if section_slug else "")

        # Regular docs use file path
        url_path = relative_str.replace('.md', '.html')
        base_url = f"https://quix.io/docs/{url_path}"
        return base_url + (f"#{section_slug}" if section_slug else "")
    except Exception as e:
        log.warning(f"Failed to build URL for {md_file}: {e}")
        return ""

def is_low_quality_block(lines, start_idx):
    """
    Detect and skip low-quality content blocks.
    Returns: (is_low_quality: bool, end_index: int)
    """
    if start_idx >= len(lines):
        return (False, start_idx)

    line = lines[start_idx].strip()

    # Video transcripts
    if line.startswith('??? "Transcript"') or line.startswith('!!! "Transcript"'):
        log.debug(f"  Skipping video transcript block at line {start_idx}")
        # Skip until next heading or 50 lines
        end = start_idx + 1
        while end < len(lines) and end < start_idx + 50:
            if re.match(r'^#{1,4}\s+', lines[end]):
                break
            end += 1
        return (True, end)

    # Markdown tables (header separator or table rows)
    if '|' in line and ('-' in line or line.count('|') >= 3):
        log.debug(f"  Skipping markdown table at line {start_idx}")
        # Skip all consecutive table rows
        end = start_idx
        while end < len(lines) and '|' in lines[end]:
            end += 1
        return (True, end)

    # HTML blocks (div, iframe, etc.)
    if line.startswith('<div') or line.startswith('<iframe'):
        tag = 'div' if 'div' in line else 'iframe'
        log.debug(f"  Skipping HTML {tag} block at line {start_idx}")
        # Skip until closing tag
        end = start_idx + 1
        while end < len(lines):
            if f'</{tag}>' in lines[end]:
                return (True, end + 1)
            end += 1
        return (True, end)

    # Admonitions (!!!, ??? with quotes)
    if line.startswith('!!!') or (line.startswith('???') and '"' in line):
        log.debug(f"  Skipping admonition block at line {start_idx}")
        # Skip admonition block (indented content after the marker)
        end = start_idx + 1
        indent_level = len(line) - len(line.lstrip())
        while end < len(lines):
            next_line = lines[end]
            if next_line.strip() and (len(next_line) - len(next_line.lstrip())) <= indent_level:
                if not next_line.strip().startswith('???') and not next_line.strip().startswith('!!!'):
                    break
            end += 1
        return (True, end)

    # Horizontal rules
    if re.match(r'^[-*_]{3,}$', line):
        return (True, start_idx + 1)

    return (False, start_idx)

def extract_sections(content, metadata):
    """
    Extract sections from markdown content with intelligent filtering.
    Returns list of section dicts with heading, text, parent, etc.
    """
    import frontmatter

    sections = []
    lines = content.split('\n')

    current_section = {
        'heading': None,
        'level': 0,
        'paragraphs': [],
        'parent_heading': None
    }

    heading_stack = []  # Track heading hierarchy (H2 > H3 > H4)
    in_code_block = False
    filtered_count = 0
    i = 0

    while i < len(lines):
        line = lines[i]

        # Toggle code block state
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            # Skip code blocks entirely (don't index code)
            i += 1
            continue

        # Skip lines inside code blocks
        if in_code_block:
            i += 1
            continue

        # Check for low-quality blocks
        is_bad, skip_to = is_low_quality_block(lines, i)
        if is_bad:
            filtered_count += 1
            i = skip_to
            continue

        # Check for markdown headings
        header_match = re.match(r'^(#{1,4})\s+(.+)$', line)
        if header_match:
            # Save previous section if it has content
            if current_section['paragraphs']:
                text = '\n'.join(current_section['paragraphs']).strip()
                if text and len(text) > 20:  # Minimum content length
                    sections.append({
                        'heading': current_section['heading'],
                        'level': current_section['level'],
                        'parent_heading': current_section['parent_heading'],
                        'text': text
                    })

            # Start new section
            level = len(header_match.group(1))
            heading = header_match.group(2).strip()

            # Update heading stack for hierarchy tracking
            while heading_stack and heading_stack[-1]['level'] >= level:
                heading_stack.pop()

            parent = heading_stack[-1]['heading'] if heading_stack else None
            heading_stack.append({'heading': heading, 'level': level})

            current_section = {
                'heading': heading,
                'level': level,
                'paragraphs': [],
                'parent_heading': parent
            }
            i += 1
            continue

        # Accumulate paragraph content
        if line.strip():
            current_section['paragraphs'].append(line.strip())
        elif current_section['paragraphs'] and current_section['paragraphs'][-1] != '':
            # Empty line = paragraph break (preserve structure)
            current_section['paragraphs'].append('')

        i += 1

    # Save final section
    if current_section['paragraphs']:
        text = '\n'.join(current_section['paragraphs']).strip()
        if text and len(text) > 20:
            sections.append({
                'heading': current_section['heading'],
                'level': current_section['level'],
                'parent_heading': current_section['parent_heading'],
                'text': text
            })

    log.debug(f"  Extracted {len(sections)} sections, filtered {filtered_count} low-quality blocks")
    return sections

def read_markdown(md_file):
    """Read markdown file content"""
    with open(md_file, "r", encoding="utf-8") as f:
        return f.read()

def parse_frontmatter(md_content):
    """Parse frontmatter and return metadata + clean content"""
    import frontmatter

    try:
        post = frontmatter.loads(md_content)
        metadata = post.metadata
        content = post.content

        # Clean content: remove HTML tags, images, clean links
        content = re.sub(r"<[^>]+>", "", content)  # Remove HTML
        content = re.sub(r"!\[.*?\]\(.*?\)", "", content)  # Remove images
        content = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", content)  # Keep link text only

        return metadata, content
    except Exception as e:
        log.warning(f"Failed to parse frontmatter: {e}")
        return {}, md_content

# -------------------------------
# Main Ingestion Logic
# -------------------------------

def ingest_docs():
    """Main ingestion function - crawl docs and index in Qdrant"""
    import frontmatter
    from sentence_transformers import SentenceTransformer
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, VectorParams, PointStruct

    log.info("Starting documentation ingestion...")

    # Connect to Qdrant
    log.info(f"Connecting to Qdrant at {QDRANT_URL}")
    client = QdrantClient(url=QDRANT_URL)

    # Delete existing collection (fresh start)
    try:
        client.delete_collection(collection_name=COLLECTION)
        log.info(f"Deleted existing collection: {COLLECTION}")
    except Exception as e:
        log.info(f"Collection {COLLECTION} doesn't exist yet (this is fine)")

    # Load embedding model
    log.info(f"Loading embedding model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    vector_size = model.get_sentence_embedding_dimension()
    log.info(f"Model loaded. Vector size: {vector_size}")

    # Create collection
    log.info(f"Creating collection: {COLLECTION}")
    client.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )

    # Walk through all markdown files
    md_files = list(DOCS_ROOT.rglob("*.md"))
    log.info(f"Found {len(md_files)} markdown files to process")

    points = []
    total_sections = 0
    files_processed = 0

    for md_file in md_files:
        try:
            log.info(f"Processing: {md_file.relative_to(DOCS_ROOT)}")

            # Read and parse file
            md_content = read_markdown(md_file)
            metadata, clean_content = parse_frontmatter(md_content)

            # Extract metadata
            doc_title = metadata.get('title', md_file.stem.replace('-', ' ').title())
            doc_description = metadata.get('description', '')

            log.info(f"  Title: '{doc_title}'")
            log.info(f"  Description: {len(doc_description)} chars")

            # Extract sections
            sections = extract_sections(clean_content, metadata)
            log.info(f"  Extracted {len(sections)} sections")

            # Create search payloads for each section
            for idx, section in enumerate(sections):
                section_heading = section.get('heading')
                section_text = section.get('text', '')
                section_slug = heading_to_slug(section_heading) if section_heading else None

                # Build URL with optional section anchor
                url = build_docs_url(md_file, metadata, section_slug)

                # Create payload (Supabase-compatible format)
                payload = {
                    "title": doc_title,
                    "subtitle": section_heading,
                    "description": doc_description if doc_description else None,
                    "text": section_text,
                    "url": url,
                    "heading": section_heading,
                    "slug": section_slug,
                    "path": str(md_file.relative_to(DOCS_ROOT)),
                }

                # Generate embedding
                embedding = model.encode(section_text).tolist()

                # Create point
                point_id = str(uuid.uuid4())
                point = PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload=payload
                )
                points.append(point)
                total_sections += 1

                log.info(f"    Section {idx+1}: '{section_heading or '(page-level)'}' ({len(section_text)} chars)")

            files_processed += 1

            # Batch upsert every 100 points
            if len(points) >= 100:
                client.upsert(collection_name=COLLECTION, points=points)
                log.info(f"Indexed batch of {len(points)} sections")
                points = []

        except Exception as e:
            log.error(f"Failed to process {md_file}: {e}")
            log.error(traceback.format_exc())
            continue

    # Upsert remaining points
    if points:
        client.upsert(collection_name=COLLECTION, points=points)
        log.info(f"Indexed final batch of {len(points)} sections")

    log.info("="*70)
    log.info(f"Ingestion complete!")
    log.info(f"  Files processed: {files_processed}/{len(md_files)}")
    log.info(f"  Total sections indexed: {total_sections}")
    log.info("="*70)

# -------------------------------
# Entry Point
# -------------------------------

if __name__ == "__main__":
    try:
        ingest_docs()
    except KeyboardInterrupt:
        log.info("Ingestion interrupted by user")
        sys.exit(0)
    except Exception as e:
        log.error(f"Ingestion failed: {e}")
        log.error(traceback.format_exc())
        sys.exit(1)
