import { elasticsearchClient, elasticsearchConfig } from '../config/elasticsearch.config';
import { logger } from '../config/logger.config';
import { Publication } from '../models/publication.entity';

export interface SemanticSearchRequest {
  query: string;
  type?: 'name' | 'cpf' | 'oab' | 'process' | 'content';
  tribunals?: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  size?: number;
  from?: number;
  boost?: {
    exact?: number;
    semantic?: number;
    fuzzy?: number;
  };
}

export interface SemanticSearchResult {
  publications: PublicationResult[];
  total: number;
  took: number;
  suggestions?: string[];
  aggregations?: {
    tribunals: Array<{ key: string; count: number }>;
    dates: Array<{ key: string; count: number }>;
    categories: Array<{ key: string; count: number }>;
  };
}

export interface PublicationResult extends Omit<Publication, 'createdAt'> {
  score: number;
  highlights?: {
    content?: string[];
    parties?: string[];
    summary?: string[];
  };
  createdAt: Date;
}

export class ElasticsearchService {
  private readonly index = elasticsearchConfig.indices.publications;
  private readonly suggestionsIndex = elasticsearchConfig.indices.suggestions;

  /**
   * Test connection with Elasticsearch
   */
  async ping(): Promise<boolean> {
    try {
      const response = await elasticsearchClient.ping();
      return response.statusCode === 200;
    } catch (error) {
      logger.error('Elasticsearch ping failed:', error);
      return false;
    }
  }

  /**
   * Index a publication document
   */
  async indexPublication(publication: Publication): Promise<void> {
    try {
      const doc = await this.enrichDocument(publication);
      
      await elasticsearchClient.index({
        index: this.index,
        id: publication.id,
        body: doc,
        refresh: 'wait_for'
      });

      logger.debug(`Indexed publication ${publication.id}`);
    } catch (error) {
      logger.error(`Failed to index publication ${publication.id}:`, error);
      throw error;
    }
  }

  /**
   * Bulk index multiple publications
   */
  async bulkIndexPublications(publications: Publication[]): Promise<void> {
    try {
      if (publications.length === 0) return;

      const body = [];
      for (const pub of publications) {
        const doc = await this.enrichDocument(pub);
        body.push({ index: { _index: this.index, _id: pub.id } });
        body.push(doc);
      }

      const response = await elasticsearchClient.bulk({
        body,
        refresh: 'wait_for'
      });

      if (response.errors) {
        const errorItems = response.items.filter((item: any) => item.index?.error);
        logger.error('Bulk indexing errors:', errorItems);
        throw new Error(`Bulk indexing failed for ${errorItems.length} documents`);
      }

      logger.info(`Successfully indexed ${publications.length} publications`);
    } catch (error) {
      logger.error('Bulk indexing failed:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search
   */
  async semanticSearch(request: SemanticSearchRequest): Promise<SemanticSearchResult> {
    try {
      const query = this.buildSemanticQuery(request);
      const size = Math.min(request.size || 20, elasticsearchConfig.settings.maxSize);
      const from = request.from || 0;

      const searchRequest = {
        index: this.index,
        body: {
          query,
          size,
          from,
          highlight: {
            fields: {
              content: {
                fragment_size: 150,
                number_of_fragments: 3,
                pre_tags: ['<mark>'],
                post_tags: ['</mark>']
              },
              parties: {
                fragment_size: 100,
                number_of_fragments: 2,
                pre_tags: ['<mark>'],
                post_tags: ['</mark>']
              },
              summary: {
                fragment_size: 100,
                number_of_fragments: 2,
                pre_tags: ['<mark>'],
                post_tags: ['</mark>']
              }
            }
          },
          aggs: {
            tribunals: {
              terms: { field: 'tribunal', size: 20 }
            },
            dates: {
              date_histogram: {
                field: 'date',
                interval: 'month',
                format: 'yyyy-MM'
              }
            },
            categories: {
              terms: { field: 'category', size: 10 }
            }
          },
          sort: [
            { _score: { order: 'desc' } },
            { date: { order: 'desc' } }
          ]
        }
      };

      const response = await elasticsearchClient.search(searchRequest);

      return this.formatSearchResponse(response, request);
    } catch (error) {
      logger.error('Semantic search failed:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string, type?: string): Promise<string[]> {
    try {
      const searchRequest = {
        index: this.suggestionsIndex,
        body: {
          suggest: {
            suggestions: {
              prefix: query.toLowerCase(),
              completion: {
                field: 'suggest',
                size: 10,
                skip_duplicates: true
              }
            }
          }
        }
      };

      if (type) {
        (searchRequest.body.suggest.suggestions.completion as any)['contexts'] = {
          type: [type]
        };
      }

      const response = await elasticsearchClient.search(searchRequest);
      
      return response.suggest?.suggestions?.[0]?.options?.map((option: any) => option.text) || [];
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      return [];
    }
  }

  /**
   * Update search suggestion frequency
   */
  async updateSuggestion(term: string, type: string): Promise<void> {
    try {
      const id = `${type}_${term.toLowerCase().replace(/\s+/g, '_')}`;
      
      await elasticsearchClient.update({
        index: this.suggestionsIndex,
        id,
        body: {
          script: {
            source: 'ctx._source.frequency++; ctx._source.lastUsed = params.now',
            params: { now: new Date().toISOString() }
          },
          upsert: {
            suggest: {
              input: [term],
              contexts: { type: [type] }
            },
            term,
            type,
            frequency: 1,
            lastUsed: new Date().toISOString()
          }
        },
        refresh: true
      });
    } catch (error) {
      logger.warn('Failed to update suggestion:', error);
    }
  }

  /**
   * Get related publications based on content similarity
   */
  async getRelatedPublications(publicationId: string, size: number = 5): Promise<PublicationResult[]> {
    try {
      // First get the source publication
      const sourceDoc = await elasticsearchClient.get({
        index: this.index,
        id: publicationId
      });

      if (!sourceDoc.found) {
        return [];
      }

      const source = sourceDoc._source as any;

      // Find similar documents using more-like-this query
      const query = {
        more_like_this: {
          fields: ['content', 'parties', 'summary'],
          like: [
            {
              _index: this.index,
              _id: publicationId
            }
          ],
          min_term_freq: 2,
          max_query_terms: 15,
          min_doc_freq: 3,
          minimum_should_match: '30%'
        }
      };

      const response = await elasticsearchClient.search({
        index: this.index,
        body: {
          query,
          size,
          _source: true
        }
      });

      return this.formatHits(response.hits.hits);
    } catch (error) {
      logger.error('Failed to get related publications:', error);
      return [];
    }
  }

  /**
   * Delete publication from index
   */
  async deletePublication(id: string): Promise<void> {
    try {
      await elasticsearchClient.delete({
        index: this.index,
        id,
        refresh: 'wait_for'
      });
      
      logger.debug(`Deleted publication ${id} from index`);
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        logger.error(`Failed to delete publication ${id}:`, error);
        throw error;
      }
    }
  }

  /**
   * Build semantic search query
   */
  private buildSemanticQuery(request: SemanticSearchRequest): any {
    const { query, type, tribunals, dateRange, boost = {} } = request;
    
    const should = [];
    const filter = [];

    // Exact match boost
    should.push({
      multi_match: {
        query,
        fields: this.getSearchFields(type),
        type: 'phrase',
        boost: boost.exact || 3.0
      }
    });

    // Semantic match
    should.push({
      multi_match: {
        query,
        fields: this.getSearchFields(type),
        type: 'best_fields',
        operator: 'or',
        fuzziness: 'AUTO',
        boost: boost.semantic || 1.0
      }
    });

    // Fuzzy match for typos
    should.push({
      multi_match: {
        query,
        fields: this.getSearchFields(type),
        type: 'most_fields',
        fuzziness: 2,
        boost: boost.fuzzy || 0.5
      }
    });

    // Add filters
    if (tribunals && tribunals.length > 0) {
      filter.push({
        terms: { tribunal: tribunals }
      });
    }

    if (dateRange && (dateRange.from || dateRange.to)) {
      const range: any = {};
      if (dateRange.from) range.gte = dateRange.from.toISOString().split('T')[0];
      if (dateRange.to) range.lte = dateRange.to.toISOString().split('T')[0];
      
      filter.push({
        range: { date: range }
      });
    }

    const boolQuery: any = {
      should,
      minimum_should_match: 1
    };

    if (filter.length > 0) {
      boolQuery.filter = filter;
    }

    return { bool: boolQuery };
  }

  /**
   * Get search fields based on type
   */
  private getSearchFields(type?: string): string[] {
    const baseFields = ['content^2', 'summary^1.5', 'parties^2'];
    
    switch (type) {
      case 'name':
        return ['parties^3', 'content^1', 'summary^1'];
      case 'cpf':
      case 'oab':
        return ['parties^3', 'content^2', 'processNumber^2'];
      case 'process':
        return ['processNumber^3', 'content^2', 'parties^1'];
      case 'content':
        return ['content^3', 'summary^2', 'parties^1'];
      default:
        return baseFields;
    }
  }

  /**
   * Enrich document with extracted entities and metadata
   */
  private async enrichDocument(publication: Publication): Promise<any> {
    const doc = {
      ...publication,
      entities: await this.extractEntities(publication.content),
      searchableText: this.createSearchableText(publication)
    };

    return doc;
  }

  /**
   * Extract named entities from text (simplified implementation)
   */
  private async extractEntities(content: string): Promise<Array<{type: string, value: string, confidence: number}>> {
    const entities: Array<{type: string, value: string, confidence: number}> = [];
    
    // CPF pattern
    const cpfPattern = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
    const cpfs = content.match(cpfPattern) || [];
    cpfs.forEach(cpf => {
      entities.push({ type: 'cpf', value: cpf, confidence: 0.9 });
    });

    // Process number pattern
    const processPattern = /\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/g;
    const processes = content.match(processPattern) || [];
    processes.forEach(proc => {
      entities.push({ type: 'process_number', value: proc, confidence: 0.95 });
    });

    // OAB pattern
    const oabPattern = /\d{3,6}\/[A-Z]{2}/g;
    const oabs = content.match(oabPattern) || [];
    oabs.forEach(oab => {
      entities.push({ type: 'oab', value: oab, confidence: 0.85 });
    });

    return entities;
  }

  /**
   * Create searchable text combining all relevant fields
   */
  private createSearchableText(publication: Publication): string {
    const parts = [
      publication.content,
      publication.parties.join(' '),
      publication.judge || '',
      publication.summary || '',
      publication.processNumber || ''
    ].filter(Boolean);

    return parts.join(' ').toLowerCase();
  }

  /**
   * Format search response
   */
  private formatSearchResponse(response: any, request: SemanticSearchRequest): SemanticSearchResult {
    const publications = this.formatHits(response.hits.hits);
    
    const aggregations = response.aggregations ? {
      tribunals: response.aggregations.tribunals.buckets.map((b: any) => ({
        key: b.key,
        count: b.doc_count
      })),
      dates: response.aggregations.dates.buckets.map((b: any) => ({
        key: b.key_as_string,
        count: b.doc_count
      })),
      categories: response.aggregations.categories.buckets.map((b: any) => ({
        key: b.key,
        count: b.doc_count
      }))
    } : undefined;

    return {
      publications,
      total: response.hits.total.value || response.hits.total,
      took: response.took,
      aggregations
    };
  }

  /**
   * Format search hits
   */
  private formatHits(hits: any[]): PublicationResult[] {
    return hits.map(hit => ({
      ...hit._source,
      score: hit._score,
      highlights: hit.highlight ? {
        content: hit.highlight.content,
        parties: hit.highlight.parties,
        summary: hit.highlight.summary
      } : undefined
    }));
  }
}
