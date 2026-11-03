import { AppDataSource } from '../config/database.config';
import { redisClient } from '../config/redis.config';
import { logger } from '../config/logger.config';
import { Search, SearchType, SearchStatus } from '../models/search.entity';
import { Publication } from '../models/publication.entity';
import { User } from '../models/user.entity';
import { TjspScraper } from '../scrapers/tjsp-scraper';
import { ApiError } from '../utils/api-error';
import { isValidCPF } from '../utils/cpf.validator';
import { validateOAB } from '../utils/oab.validator';
import { ElasticsearchService, SemanticSearchRequest } from './elasticsearch.service';

export interface SearchRequest {
  type: 'name' | 'cpf' | 'oab';
  term: string;
  sources: string[];
  filters?: {
    startDate?: Date;
    endDate?: Date;
    tribunals?: string[];
  };
}

export interface SearchResult {
  searchId: string;
  type: 'name' | 'cpf' | 'oab';
  term: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalResults: number;
  publications: Publication[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export class SearchService {
  private searchRepository = AppDataSource.getRepository(Search);
  private publicationRepository = AppDataSource.getRepository(Publication);
  private userRepository = AppDataSource.getRepository(User);
  private elasticsearchService = new ElasticsearchService();

  // Available scrapers
  private scrapers = new Map([
    ['TJSP', new TjspScraper()]
  ]);

  /**
   * Execute a new search
   */
  public async executeSearch(
    userId: string, 
    searchRequest: SearchRequest
  ): Promise<SearchResult> {
    try {
      // Validate input
      this.validateSearchRequest(searchRequest);

      // Check cache first
      const cacheKey = this.generateCacheKey(searchRequest);
      const cachedResult = await this.getCachedResult(cacheKey);
      
      if (cachedResult) {
        logger.info(`Returning cached result for search: ${cacheKey}`);
        return cachedResult;
      }

      // Create search record
      const search = await this.createSearchRecord(userId, searchRequest);

      // Execute search
      const result = await this.performSearch(search, searchRequest);

      // Cache result
      await this.cacheResult(cacheKey, result);

      return result;

    } catch (error) {
      logger.error('Error executing search:', error);
      throw error instanceof ApiError ? error : new ApiError(500, 'Search execution failed');
    }
  }

  /**
   * Get search history for a user with pagination
   */
  public async getSearchHistory(
    userId: string, 
    options: { page: number; limit: number; status?: string }
  ): Promise<{ searches: SearchResult[]; total: number; hasNext: boolean; hasPrevious: boolean }> {
    const { page, limit, status } = options;
    const offset = (page - 1) * limit;

    const queryBuilder = this.searchRepository.createQueryBuilder('search')
      .leftJoinAndSelect('search.publications', 'publications')
      .where('search.userId = :userId', { userId })
      .orderBy('search.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (status) {
      queryBuilder.andWhere('search.status = :status', { status });
    }

    const [searches, total] = await queryBuilder.getManyAndCount();

    const searchResults: SearchResult[] = searches.map((search: Search) => ({
      searchId: search.id,
      type: search.type as 'name' | 'cpf' | 'oab',
      term: search.term,
      status: search.status as 'pending' | 'running' | 'completed' | 'failed',
      totalResults: search.totalResults || 0,
      publications: search.publications || [],
      startedAt: search.startedAt,
      completedAt: search.completedAt,
      error: search.error
    }));

    return {
      searches: searchResults,
      total,
      hasNext: offset + limit < total,
      hasPrevious: page > 1
    };
  }

  /**
   * Get a specific search by ID for a user
   */
  public async getSearchById(searchId: string, userId: string): Promise<SearchResult | null> {
    const search = await this.searchRepository.findOne({
      where: { id: searchId, userId },
      relations: ['publications']
    });

    if (!search) {
      return null;
    }

    return {
      searchId: search.id,
      type: search.type as 'name' | 'cpf' | 'oab',
      term: search.term,
      status: search.status as 'pending' | 'running' | 'completed' | 'failed',
      totalResults: search.totalResults || 0,
      publications: search.publications || [],
      startedAt: search.startedAt,
      completedAt: search.completedAt,
      error: search.error
    };
  }

  /**
   * Cancel a pending or running search
   */
  public async cancelSearch(searchId: string, userId: string): Promise<void> {
    const search = await this.searchRepository.findOne({
      where: { id: searchId, userId }
    });

    if (!search) {
      throw new ApiError(404, 'Search not found');
    }

    if (search.status === 'completed' || search.status === 'failed') {
      throw new ApiError(400, 'Cannot cancel a completed or failed search');
    }

    search.status = SearchStatus.FAILED;
    search.error = 'Cancelled by user';
    search.completedAt = new Date();

    await this.searchRepository.save(search);

    logger.info(`Search ${searchId} cancelled by user ${userId}`);
  }

  /**
   * Get search statistics for a user
   */
  public async getSearchStats(userId: string): Promise<{
    totalSearches: number;
    completedSearches: number;
    failedSearches: number;
    pendingSearches: number;
    totalResults: number;
    averageResultsPerSearch: number;
    lastSearchDate: Date | null;
  }> {
    const stats = await this.searchRepository.createQueryBuilder('search')
      .select([
        'COUNT(*) as totalSearches',
        'SUM(CASE WHEN status = \'completed\' THEN 1 ELSE 0 END) as completedSearches',
        'SUM(CASE WHEN status = \'failed\' THEN 1 ELSE 0 END) as failedSearches',
        'SUM(CASE WHEN status = \'pending\' OR status = \'running\' THEN 1 ELSE 0 END) as pendingSearches',
        'SUM(COALESCE(totalResults, 0)) as totalResults',
        'MAX(createdAt) as lastSearchDate'
      ])
      .where('userId = :userId', { userId })
      .getRawOne();

    const totalSearches = parseInt(stats.totalSearches) || 0;
    const totalResults = parseInt(stats.totalResults) || 0;
    const averageResultsPerSearch = totalSearches > 0 ? totalResults / totalSearches : 0;

    return {
      totalSearches,
      completedSearches: parseInt(stats.completedSearches) || 0,
      failedSearches: parseInt(stats.failedSearches) || 0,
      pendingSearches: parseInt(stats.pendingSearches) || 0,
      totalResults,
      averageResultsPerSearch: Math.round(averageResultsPerSearch * 100) / 100,
      lastSearchDate: stats.lastSearchDate ? new Date(stats.lastSearchDate) : null
    };
  }

  /**
   * Validate search request
   */
  private validateSearchRequest(request: SearchRequest): void {
    if (!request.term || request.term.trim().length < 2) {
      throw new ApiError(400, 'Search term must be at least 2 characters');
    }

    if (!['name', 'cpf', 'oab'].includes(request.type)) {
      throw new ApiError(400, 'Invalid search type');
    }

    if (request.type === 'cpf' && !isValidCPF(request.term)) {
      throw new ApiError(400, 'Invalid CPF format');
    }

    if (request.type === 'oab' && !validateOAB(request.term)) {
      throw new ApiError(400, 'Invalid OAB format');
    }

    if (!request.sources || request.sources.length === 0) {
      throw new ApiError(400, 'At least one source must be specified');
    }

    // Validate available sources
    const invalidSources = request.sources.filter(source => !this.scrapers.has(source));
    if (invalidSources.length > 0) {
      throw new ApiError(400, `Invalid sources: ${invalidSources.join(', ')}`);
    }
  }

  /**
   * Create search record in database
   */
  private async createSearchRecord(
    userId: string, 
    request: SearchRequest
  ): Promise<Search> {
    const search = this.searchRepository.create({
      userId,
      type: request.type,
      term: request.term,
      sources: request.sources,
      filters: request.filters || {},
      status: 'pending',
      totalResults: 0,
      startedAt: new Date()
    });

    return await this.searchRepository.save(search);
  }

  /**
   * Perform actual search using scrapers
   */
  private async performSearch(
    search: Search, 
    request: SearchRequest
  ): Promise<SearchResult> {
    try {
      // Update status to running
      search.status = SearchStatus.RUNNING;
      await this.searchRepository.save(search);

      const allPublications: Publication[] = [];
      const errors: string[] = [];

      // Execute searches in parallel for all sources
      const searchPromises = request.sources.map(async (source) => {
        try {
          const scraper = this.scrapers.get(source);
          if (!scraper) {
            throw new Error(`Scraper not found for source: ${source}`);
          }

          logger.info(`Starting search for ${request.type}:${request.term} on ${source}`);

          let publications;
          // Convert filters to scraper format
          const scraperFilters = request.filters ? {
            start: request.filters.startDate!,
            end: request.filters.endDate!
          } : undefined;

          switch (request.type) {
            case 'name':
              publications = await scraper.searchByName(request.term, scraperFilters);
              break;
            case 'cpf':
              publications = await scraper.searchByCpf(request.term, scraperFilters);
              break;
            case 'oab':
              publications = await scraper.searchByOab(request.term, scraperFilters);
              break;
            default:
              throw new Error(`Invalid search type: ${request.type}`);
          }

          // Convert to database entities and save
          const savedPublications = await this.savePublications(publications, search.id);
          return savedPublications;

        } catch (error) {
          logger.error(`Search failed for source ${source}:`, error);
          errors.push(`${source}: ${(error as Error).message}`);
          return [];
        }
      });

      // Wait for all searches to complete
      const results = await Promise.all(searchPromises);
      results.forEach(pubs => allPublications.push(...pubs));

      // Update search record
      search.status = errors.length === request.sources.length ? SearchStatus.FAILED : SearchStatus.COMPLETED;
      search.totalResults = allPublications.length;
      search.completedAt = new Date();
      await this.searchRepository.save(search);

      const result: SearchResult = {
        searchId: search.id,
        type: search.type,
        term: search.term,
        status: search.status,
        totalResults: search.totalResults,
        publications: allPublications,
        startedAt: search.startedAt || undefined,
        completedAt: search.completedAt || undefined,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };

      logger.info(`Search completed: ${search.id}, found ${allPublications.length} publications`);
      return result;

    } catch (error) {
      // Update search status to failed
      search.status = SearchStatus.FAILED;
      search.completedAt = new Date();
      await this.searchRepository.save(search);

      throw error;
    }
  }

  /**
   * Save scraped publications to database
   */
  private async savePublications(
    scrapedPublications: any[], 
    searchId: string
  ): Promise<Publication[]> {
    const publications: Publication[] = [];

    for (const scraped of scrapedPublications) {
      try {
        // Generate hash to prevent duplicates
        const hash = this.generatePublicationHash(scraped);

        // Check if publication already exists
        const existing = await this.publicationRepository.findOne({ where: { hash } });
        if (existing) {
          publications.push(existing);
          continue;
        }

        // Create new publication
        const publication = this.publicationRepository.create({
          searchId,
          title: this.extractTitle(scraped.content),
          content: scraped.content,
          tribunal: scraped.tribunal,
          section: scraped.section,
          publicationDate: scraped.date,
          url: scraped.url,
          hash,
          metadata: scraped.metadata || {}
        });

        const saved = await this.publicationRepository.save(publication);
        publications.push(saved);

        // Index in Elasticsearch asynchronously
        this.elasticsearchService.indexPublication(saved).catch(error => {
          logger.warn('Failed to index publication in Elasticsearch:', error);
        });

      } catch (error) {
        logger.warn('Error saving publication:', error);
      }
    }

    return publications;
  }

  /**
   * Generate unique hash for publication
   */
  private generatePublicationHash(publication: any): string {
    const content = `${publication.tribunal}-${publication.date}-${publication.content}`;
    return this.generateHash(content);
  }

  /**
   * Extract title from publication content
   */
  private extractTitle(content: string): string {
    // Try to extract a meaningful title from content
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      return lines[0].substring(0, 200).trim();
    }
    return content.substring(0, 100).trim();
  }

  /**
   * Simple hash function for generating cache keys
   */
  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate cache key for search
   */
  private generateCacheKey(request: SearchRequest): string {
    const key = `search:${request.type}:${request.term}:${request.sources.sort().join(',')}`;
    if (request.filters) {
      const filtersStr = JSON.stringify(request.filters);
      return this.generateHash(key + filtersStr);
    }
    return this.generateHash(key);
  }

  /**
   * Get cached search result
   */
  private async getCachedResult(cacheKey: string): Promise<SearchResult | null> {
    try {
      const cached = await redisClient.get(`cache:${cacheKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn('Error getting cached result:', error);
    }
    return null;
  }

  /**
   * Cache search result
   */
  private async cacheResult(cacheKey: string, result: SearchResult): Promise<void> {
    try {
      // Cache for 1 hour
      await redisClient.setEx(`cache:${cacheKey}`, 3600, JSON.stringify(result));
    } catch (error) {
      logger.warn('Error caching result:', error);
    }
  }

  /**
   * Perform semantic search using Elasticsearch
   */
  public async semanticSearch(
    userId: string,
    request: SemanticSearchRequest
  ): Promise<{
    results: any[];
    total: number;
    took: number;
    suggestions?: string[];
    aggregations?: any;
  }> {
    try {
      // Update search suggestion frequency
      if (request.query) {
        await this.elasticsearchService.updateSuggestion(
          request.query, 
          request.type || 'content'
        );
      }

      // Perform semantic search
      const searchResult = await this.elasticsearchService.semanticSearch(request);

      // Log search for analytics
      await this.logSemanticSearch(userId, request, searchResult.total);

      return {
        results: searchResult.publications,
        total: searchResult.total,
        took: searchResult.took,
        suggestions: searchResult.suggestions,
        aggregations: searchResult.aggregations
      };
    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw new ApiError(500, 'Search temporarily unavailable');
    }
  }

  /**
   * Get search suggestions
   */
  public async getSuggestions(query: string, type?: string): Promise<string[]> {
    try {
      return await this.elasticsearchService.getSuggestions(query, type);
    } catch (error) {
      logger.warn('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Get related publications
   */
  public async getRelatedPublications(publicationId: string, size: number = 5): Promise<any[]> {
    try {
      return await this.elasticsearchService.getRelatedPublications(publicationId, size);
    } catch (error) {
      logger.warn('Failed to get related publications:', error);
      return [];
    }
  }

  /**
   * Index publications in Elasticsearch after scraping
   */
  private async indexScrapedPublications(publications: any[]): Promise<void> {
    try {
      if (publications.length === 0) return;

      // Convert scraped data to Publication entities
      const publicationEntities = publications.map(pub => {
        const publication = new Publication();
        publication.tribunal = pub.tribunal || 'TJSP';
        publication.date = new Date(pub.date);
        publication.content = pub.content;
        publication.page = pub.page || 1;
        publication.url = pub.url || '';
        publication.processNumber = pub.processNumber;
        publication.parties = Array.isArray(pub.parties) ? pub.parties : [];
        publication.judge = pub.judge;
        publication.category = pub.category;
        publication.summary = pub.summary;
        return publication;
      });

      // Bulk index in Elasticsearch
      await this.elasticsearchService.bulkIndexPublications(publicationEntities);
      
      logger.info(`Indexed ${publications.length} publications in Elasticsearch`);
    } catch (error) {
      logger.error('Failed to index publications in Elasticsearch:', error);
      // Don't throw - this is not critical for search functionality
    }
  }

  /**
   * Log semantic search for analytics
   */
  private async logSemanticSearch(
    userId: string, 
    request: SemanticSearchRequest, 
    resultCount: number
  ): Promise<void> {
    try {
      const search = this.searchRepository.create({
        userId,
        type: request.type === 'content' ? SearchType.NAME : 
              request.type === 'cpf' ? SearchType.CPF :
              request.type === 'oab' ? SearchType.OAB : SearchType.NAME,
        term: request.query,
        status: SearchStatus.COMPLETED,
        sources: request.tribunals || ['elasticsearch'],
        totalResults: resultCount,
        startedAt: new Date(),
        completedAt: new Date()
      });

      await this.searchRepository.save(search);
    } catch (error) {
      logger.warn('Failed to log semantic search:', error);
    }
  }

  /**
   * Cleanup method to close all scrapers
   */
  public async cleanup(): Promise<void> {
    for (const scraper of this.scrapers.values()) {
      await scraper.cleanup();
    }
  }
}
