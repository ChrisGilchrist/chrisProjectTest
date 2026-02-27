import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, filter } from 'rxjs/operators';
import { MkDocsSearchService, SearchResult } from './mkdocs-search.service';

@Component({
  selector: 'app-doc-search',
  templateUrl: './doc-search.component.html',
  styleUrls: ['./doc-search.component.scss']
})
export class DocSearchComponent implements OnInit, OnDestroy {
  searchControl = new FormControl('');
  results: SearchResult[] = [];
  loading = false;
  indexReady = false;
  loadError: string | null = null;
  documentCount = 0;

  private destroy$ = new Subject<void>();

  constructor(public searchService: MkDocsSearchService) {}

  ngOnInit(): void {
    // Monitor index ready state
    this.searchService.isReady()
      .pipe(takeUntil(this.destroy$))
      .subscribe(ready => {
        this.indexReady = ready;
        if (ready) {
          this.documentCount = this.searchService.getDocumentCount();
          console.log(`Search ready with ${this.documentCount} documents`);
        }
      });

    // Monitor load errors
    this.searchService.getLoadError()
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.loadError = error;
      });

    // Set up search with debouncing
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(), // Only search if value changed
        takeUntil(this.destroy$)
      )
      .subscribe(query => {
        this.performSearch(query || '');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Perform the search
   */
  private performSearch(query: string): void {
    // Clear results if query too short
    if (!query || query.length < 2) {
      this.results = [];
      this.loading = false;
      return;
    }

    // Don't search if index not ready
    if (!this.indexReady) {
      console.warn('Search index not ready');
      return;
    }

    this.loading = true;

    this.searchService.search(query, 15)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results) => {
          this.results = results;
          this.loading = false;
          console.log(`Displaying ${results.length} results`);
        },
        error: (err) => {
          console.error('Search error:', err);
          this.loading = false;
          this.results = [];
        }
      });
  }

  /**
   * Open documentation link in new tab
   */
  openDoc(url: string): void {
    window.open(url, '_blank');
  }

  /**
   * Highlight search terms in text
   */
  highlightQuery(text: string, query: string): string {
    if (!query || !text) return text;

    // Split query into words
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    let highlighted = text;

    // Highlight each word
    words.forEach(word => {
      const regex = new RegExp(`(${this.escapeRegex(word)})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    });

    return highlighted;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Format score as percentage
   */
  formatScore(score: number): string {
    return (score * 100).toFixed(0);
  }

  /**
   * Reload search index
   */
  reloadIndex(): void {
    this.searchService.reload();
    this.results = [];
    this.searchControl.setValue('');
  }
}
