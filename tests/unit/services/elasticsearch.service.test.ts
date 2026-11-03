/**
 * Unit tests for ElasticsearchService
 */

import { ElasticsearchService, SemanticSearchRequest } from '../../../src/services/elasticsearch.service';

// Mock Elasticsearch client
jest.mock('../../../src/config/elasticsearch.config', () => ({
  elasticsearchClient: {
    ping: jest.fn(),
    index: jest.fn(),
    bulk: jest.fn(),
    search: jest.fn(),
    delete: jest.fn(),
  },
  elasticsearchConfig: {
    indices: {
      publications: 'test-publications',
      suggestions: 'test-suggestions',
    },
    settings: {
      maxSize: 100,
    },
  },
}));

// Mock logger
jest.mock('../../../src/config/logger.config', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ElasticsearchService', () => {
  let elasticsearchService: ElasticsearchService;
  
  beforeEach(() => {
    elasticsearchService = new ElasticsearchService();
    jest.clearAllMocks();
  });

  describe('ping', () => {
    it('should return true when ping is successful', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.ping.mockResolvedValue({ statusCode: 200 });

      const result = await elasticsearchService.ping();
      
      expect(result).toBe(true);
      expect(elasticsearchClient.ping).toHaveBeenCalled();
    });

    it('should return false when ping fails', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await elasticsearchService.ping();
      
      expect(result).toBe(false);
      expect(elasticsearchClient.ping).toHaveBeenCalled();
    });
  });

  describe('indexPublication', () => {
    it('should index a publication successfully', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.index.mockResolvedValue({ _id: 'test-id' });

      const publication = {
        id: 'test-id',
        title: 'Test Publication',
        content: 'Test content',
        parties: ['Party A', 'Party B'],
        publishDate: new Date(),
        tribunal: 'TJSP',
        category: 'Civil',
        url: 'https://example.com',
        type: 'publication' as const,
        summary: 'Test summary',
        createdAt: new Date(),
      };

      await elasticsearchService.indexPublication(publication);
      
      expect(elasticsearchClient.index).toHaveBeenCalledWith({
        index: 'test-publications',
        id: 'test-id',
        body: expect.any(Object),
        refresh: 'wait_for',
      });
    });

    it('should throw error when indexing fails', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.index.mockRejectedValue(new Error('Index failed'));

      const publication = {
        id: 'test-id',
        title: 'Test Publication',
        content: 'Test content',
        parties: ['Party A'],
        publishDate: new Date(),
        tribunal: 'TJSP',
        category: 'Civil',
        url: 'https://example.com',
        type: 'publication' as const,
        summary: 'Test summary',
        createdAt: new Date(),
      };

      await expect(elasticsearchService.indexPublication(publication))
        .rejects.toThrow('Index failed');
    });
  });

  describe('semanticSearch', () => {
    it('should perform semantic search successfully', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      
      const mockResponse = {
        took: 15,
        hits: {
          total: { value: 1 },
          hits: [
            {
              _id: 'test-id',
              _score: 1.5,
              _source: {
                id: 'test-id',
                title: 'Test Publication',
                content: 'Test content',
                tribunal: 'TJSP',
                publishDate: '2024-01-01',
              },
              highlight: {
                content: ['Test <em>content</em>'],
              },
            },
          ],
        },
        aggregations: {
          tribunals: {
            buckets: [{ key: 'TJSP', doc_count: 1 }],
          },
        },
      };

      elasticsearchClient.search.mockResolvedValue(mockResponse);

      const request: SemanticSearchRequest = {
        query: 'test query',
        type: 'content',
        size: 10,
        from: 0,
      };

      const result = await elasticsearchService.semanticSearch(request);
      
      expect(result.total).toBe(1);
      expect(result.took).toBe(15);
      expect(result.publications).toHaveLength(1);
      expect(result.publications[0].title).toBe('Test Publication');
      expect(elasticsearchClient.search).toHaveBeenCalled();
    });

    it('should handle empty search results', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      
      const mockResponse = {
        took: 5,
        hits: {
          total: { value: 0 },
          hits: [],
        },
      };

      elasticsearchClient.search.mockResolvedValue(mockResponse);

      const request: SemanticSearchRequest = {
        query: 'nonexistent',
        size: 10,
      };

      const result = await elasticsearchService.semanticSearch(request);
      
      expect(result.total).toBe(0);
      expect(result.publications).toHaveLength(0);
    });
  });

  describe('getSuggestions', () => {
    it('should return search suggestions', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      
      const mockResponse = {
        suggest: {
          title_suggest: [
            {
              options: [
                { text: 'contract suggestion', _score: 1.0 },
                { text: 'contract law', _score: 0.8 },
              ],
            },
          ],
        },
      };

      elasticsearchClient.search.mockResolvedValue(mockResponse);

      const result = await elasticsearchService.getSuggestions('contract', 'name', 5);
      
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0]).toBe('contract suggestion');
      expect(result.suggestions[1]).toBe('contract law');
    });
  });

  describe('getRelatedPublications', () => {
    it('should return related publications', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      
      const mockResponse = {
        hits: {
          hits: [
            {
              _id: 'related-1',
              _score: 1.2,
              _source: {
                id: 'related-1',
                title: 'Related Publication',
                content: 'Related content',
                tribunal: 'STJ',
              },
            },
          ],
        },
      };

      elasticsearchClient.search.mockResolvedValue(mockResponse);

      const result = await elasticsearchService.getRelatedPublications('test-id', 5);
      
      expect(result.related).toHaveLength(1);
      expect(result.related[0].title).toBe('Related Publication');
    });
  });

  describe('deletePublication', () => {
    it('should delete publication successfully', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.delete.mockResolvedValue({ result: 'deleted' });

      await elasticsearchService.deletePublication('test-id');
      
      expect(elasticsearchClient.delete).toHaveBeenCalledWith({
        index: 'test-publications',
        id: 'test-id',
        refresh: 'wait_for',
      });
    });

    it('should handle 404 errors gracefully', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      const error = new Error('Not found');
      (error as any).meta = { statusCode: 404 };
      elasticsearchClient.delete.mockRejectedValue(error);

      // Should not throw error for 404
      await expect(elasticsearchService.deletePublication('test-id'))
        .resolves.not.toThrow();
    });

    it('should throw error for other failures', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      const error = new Error('Server error');
      (error as any).meta = { statusCode: 500 };
      elasticsearchClient.delete.mockRejectedValue(error);

      await expect(elasticsearchService.deletePublication('test-id'))
        .rejects.toThrow('Server error');
    });
  });

  describe('bulkIndexPublications', () => {
    it('should handle empty array', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      
      await elasticsearchService.bulkIndexPublications([]);
      
      expect(elasticsearchClient.bulk).not.toHaveBeenCalled();
    });

    it('should perform bulk indexing successfully', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.bulk.mockResolvedValue({ errors: false, items: [] });

      const publications = [
        {
          id: 'test-1',
          title: 'Test Publication 1',
          content: 'Test content 1',
          parties: ['Party A'],
          publishDate: new Date(),
          tribunal: 'TJSP',
          category: 'Civil',
          url: 'https://example.com/1',
          type: 'publication' as const,
          summary: 'Test summary 1',
          createdAt: new Date(),
        },
        {
          id: 'test-2',
          title: 'Test Publication 2',
          content: 'Test content 2',
          parties: ['Party B'],
          publishDate: new Date(),
          tribunal: 'STJ',
          category: 'Criminal',
          url: 'https://example.com/2',
          type: 'publication' as const,
          summary: 'Test summary 2',
          createdAt: new Date(),
        },
      ];

      await elasticsearchService.bulkIndexPublications(publications);
      
      expect(elasticsearchClient.bulk).toHaveBeenCalledWith({
        body: expect.any(Array),
        refresh: 'wait_for',
      });
    });

    it('should handle bulk indexing errors', async () => {
      const { elasticsearchClient } = require('../../../src/config/elasticsearch.config');
      elasticsearchClient.bulk.mockResolvedValue({
        errors: true,
        items: [
          { index: { error: { reason: 'Document already exists' } } },
        ],
      });

      const publications = [
        {
          id: 'test-1',
          title: 'Test Publication',
          content: 'Test content',
          parties: ['Party A'],
          publishDate: new Date(),
          tribunal: 'TJSP',
          category: 'Civil',
          url: 'https://example.com',
          type: 'publication' as const,
          summary: 'Test summary',
          createdAt: new Date(),
        },
      ];

      await expect(elasticsearchService.bulkIndexPublications(publications))
        .rejects.toThrow('Bulk indexing failed');
    });
  });
});
