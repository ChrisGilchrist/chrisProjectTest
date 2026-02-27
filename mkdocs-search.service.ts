import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, from, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import * as lunr from 'lunr';

export interface MkDocsSearchDoc {
  location: string;
  title: string;
  text: string;
}

export interface MkDocsSearchIndex {
  config: {
    lang: string[];
    separator: string;
    pipeline: string[];
    fields: Record<string, { boost: number }>;
  };
  docs: MkDocsSearchDoc[];
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  location: string;
  score: number;
}

@Injectable({
  providedIn: 'root'
})
export class MkDocsSearchService {
  // URL to the MkDocs search index
  private readonly SEARCH_INDEX_URL = 'https://quix.io/docs/search/search_index.json';
  private readonly DOCS_BASE_URL = 'https://quix.io/docs/';

  private searchIndex: lunr.Index | null = null;
  private documents: MkDocsSearchDoc[] = [];
  private indexReady$ = new BehaviorSubject<boolean>(false);
  private loadError$ = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient) {
    this.loadSearchIndex();
  }

  /**
   * Load and initialize the MkDocs search index
   */
  private loadSearchIndex(): void {
    console.log('Loading MkDocs search index from:', this.SEARCH_INDEX_URL);

    this.http.get<MkDocsSearchIndex>(this.SEARCH_INDEX_URL)
      .pipe(
        tap(data => {
          console.log('✓ Search index loaded successfully');
          console.log(`  - ${data.docs.length} documents indexed`);
          console.log('  - Config:', data.config);
        }),
        catchError(err => {
          console.error('✗ Failed to load search index:', err);
          this.loadError$.next(err.message || 'Failed to load search index');
          this.indexReady$.next(false);
          throw err;
        })
      )
      .subscribe({
        next: (data) => {
          this.documents = data.docs;
          this.buildLunrIndex(data);
          this.indexReady$.next(true);
          this.loadError$.next(null);
        },
        error: (err) => {
          console.error('Error in search index subscription:', err);
        }
      });
  }

  /**
   * Build lunr.js index exactly like MkDocs does
   */
  private buildLunrIndex(data: MkDocsSearchIndex): void {
    console.log('Building lunr.js search index...');

    this.searchIndex = lunr(function() {
      // Configure the index reference field
      this.ref('location');

      // Add fields with MkDocs' boost configuration
      // Title has massive boost (1000) for exact title matches
      // Text has normal boost (1)
      // Tags would have even higher boost (1000000) if present
      this.field('title', { boost: data.config.fields.title.boost });
      this.field('text', { boost: data.config.fields.text.boost });

      // MkDocs uses stopWordFilter in pipeline
      // lunr.js includes this by default, so no need to add it

      // Add all documents to the index
      data.docs.forEach(doc => {
        // Strip HTML from text before indexing (like MkDocs does)
        const cleanText = this.stripHtml(doc.text);

        this.add({
          location: doc.location,
          title: doc.title,
          text: cleanText
        });
      }, this);
    });

    console.log('✓ lunr.js index built successfully');
  }

  /**
   * Strip HTML tags from text
   * This matches how MkDocs processes text for indexing
   */
  private stripHtml(html: string): string {
    if (!html) return '';

    // Create temporary DOM element to strip HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // Get text content
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Check if search index is ready
   */
  isReady(): Observable<boolean> {
    return this.indexReady$.asObservable();
  }

  /**
   * Get any load errors
   */
  getLoadError(): Observable<string | null> {
    return this.loadError$.asObservable();
  }

  /**
   * Search the documentation using lunr.js
   * This implements the same search logic as MkDocs Material theme
   */
  search(query: string, limit: number = 10): Observable<SearchResult[]> {
    // Validate inputs
    if (!query || query.trim().length < 2) {
      return of([]);
    }

    if (!this.searchIndex) {
      console.warn('Search index not ready yet');
      return of([]);
    }

    try {
      console.log(`Searching for: "${query}"`);

      // Perform lunr.js search
      // lunr will tokenize the query using the same separator as MkDocs: [\s\-\.]
      const results = this.searchIndex.search(query);

      console.log(`  - Found ${results.length} results`);

      // Map lunr results to our SearchResult format
      const mappedResults = results
        .slice(0, limit)
        .map(result => {
          // Find the original document
          const doc = this.documents.find(d => d.location === result.ref);

          if (!doc) {
            console.warn('Document not found for ref:', result.ref);
            return null;
          }

          // Strip HTML from text for display
          const cleanText = this.stripHtml(doc.text);

          // Create context snippet around search terms
          const snippet = this.createSnippet(cleanText, query, 200);

          return {
            title: doc.title,
            snippet: snippet || cleanText.substring(0, 200) + '...',
            url: this.DOCS_BASE_URL + doc.location,
            location: doc.location,
            score: result.score
          };
        })
        .filter(result => result !== null) as SearchResult[];

      console.log(`  - Returning ${mappedResults.length} results`);

      return of(mappedResults);

    } catch (error) {
      console.error('Search error:', error);
      return of([]);
    }
  }

  /**
   * Create a snippet around the search term
   * Shows context around where the search term appears
   */
  private createSnippet(text: string, query: string, maxLength: number = 200): string {
    if (!text) return '';

    // Find the query in the text (case insensitive)
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase().split(' ')[0]; // Use first word of query
    const queryIndex = lowerText.indexOf(lowerQuery);

    if (queryIndex === -1) {
      // Query not found, return start of text
      return text.substring(0, maxLength).trim() + (text.length > maxLength ? '...' : '');
    }

    // Calculate snippet boundaries centered around the query
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, queryIndex - halfLength);
    let end = Math.min(text.length, start + maxLength);

    // Adjust start if we're near the end
    if (end - start < maxLength) {
      start = Math.max(0, end - maxLength);
    }

    // Try to start/end at word boundaries
    if (start > 0) {
      const nextSpace = text.indexOf(' ', start);
      if (nextSpace !== -1 && nextSpace - start < 20) {
        start = nextSpace + 1;
      }
    }

    if (end < text.length) {
      const prevSpace = text.lastIndexOf(' ', end);
      if (prevSpace !== -1 && end - prevSpace < 20) {
        end = prevSpace;
      }
    }

    let snippet = text.substring(start, end).trim();

    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Get total document count
   */
  getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Get all documents (for debugging)
   */
  getAllDocuments(): MkDocsSearchDoc[] {
    return this.documents;
  }

  /**
   * Reload the search index
   */
  reload(): void {
    this.searchIndex = null;
    this.documents = [];
    this.indexReady$.next(false);
    this.loadSearchIndex();
  }
}
