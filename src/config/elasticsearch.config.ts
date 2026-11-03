import { Client } from '@elastic/elasticsearch';
import { appConfig } from './app.config';
import { logger } from './logger.config';

// Elasticsearch client configuration
export const elasticsearchClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? {
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD
  } : undefined,
  maxRetries: 5,
  requestTimeout: 60000,
  sniffOnStart: true,
  sniffInterval: 300000, // 5 minutes
});

// Test connection
export const testElasticsearchConnection = async (): Promise<boolean> => {
  try {
    const response = await elasticsearchClient.ping();
    logger.info('Elasticsearch connection successful');
    return true;
  } catch (error) {
    logger.error('Elasticsearch connection failed:', error);
    return false;
  }
};

// Initialize indices with proper mappings
export const initializeElasticsearchIndices = async (): Promise<void> => {
  try {
    // Publications index mapping optimized for legal text
    const publicationsMapping = {
      settings: {
        analysis: {
          analyzer: {
            legal_text_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'asciifolding',
                'legal_stopwords',
                'legal_synonyms',
                'stemmer_brazilian'
              ]
            },
            search_analyzer: {
              type: 'custom',
              tokenizer: 'standard',
              filter: [
                'lowercase',
                'asciifolding',
                'legal_stopwords'
              ]
            }
          },
          filter: {
            legal_stopwords: {
              type: 'stop',
              stopwords: [
                'a', 'o', 'e', 'de', 'da', 'do', 'em', 'na', 'no', 'para', 'por',
                'com', 'que', 'se', 'ao', 'dos', 'das', 'um', 'uma', 'seu', 'sua'
              ]
            },
            legal_synonyms: {
              type: 'synonym',
              synonyms: [
                'requerente,autor,demandante',
                'requerido,réu,demandado',
                'processo,ação,procedimento',
                'decisão,sentença,acórdão',
                'tribunal,corte,juízo'
              ]
            },
            stemmer_brazilian: {
              type: 'stemmer',
              language: 'brazilian'
            }
          }
        },
        max_result_window: 50000
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          tribunal: { type: 'keyword' },
          date: { type: 'date' },
          content: {
            type: 'text',
            analyzer: 'legal_text_analyzer',
            search_analyzer: 'search_analyzer',
            fields: {
              keyword: { type: 'keyword' },
              raw: { type: 'text', analyzer: 'standard' }
            }
          },
          page: { type: 'integer' },
          url: { type: 'keyword' },
          processNumber: {
            type: 'text',
            analyzer: 'keyword',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          parties: {
            type: 'text',
            analyzer: 'legal_text_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          judge: {
            type: 'text',
            analyzer: 'legal_text_analyzer',
            fields: {
              keyword: { type: 'keyword' }
            }
          },
          category: { type: 'keyword' },
          summary: {
            type: 'text',
            analyzer: 'legal_text_analyzer'
          },
          entities: {
            type: 'nested',
            properties: {
              type: { type: 'keyword' },
              value: { type: 'keyword' },
              confidence: { type: 'float' }
            }
          },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' }
        }
      }
    };

    // Check if index exists
    const indexExists = await elasticsearchClient.indices.exists({
      index: 'legal_publications'
    });

    if (!indexExists) {
      await elasticsearchClient.indices.create({
        index: 'legal_publications',
        body: publicationsMapping
      });
      logger.info('Created legal_publications index with optimized mappings');
    } else {
      logger.info('legal_publications index already exists');
    }

    // Create search suggestions index
    const suggestionsMapping = {
      mappings: {
        properties: {
          suggest: {
            type: 'completion',
            analyzer: 'simple',
            preserve_separators: true,
            preserve_position_increments: true,
            max_input_length: 50
          },
          term: { type: 'keyword' },
          type: { type: 'keyword' }, // name, cpf, oab, process_number
          frequency: { type: 'integer' },
          lastUsed: { type: 'date' }
        }
      }
    };

    const suggestionsExists = await elasticsearchClient.indices.exists({
      index: 'search_suggestions'
    });

    if (!suggestionsExists) {
      await elasticsearchClient.indices.create({
        index: 'search_suggestions',
        body: suggestionsMapping
      });
      logger.info('Created search_suggestions index');
    }

  } catch (error) {
    logger.error('Failed to initialize Elasticsearch indices:', error);
    throw error;
  }
};

export const elasticsearchConfig = {
  indices: {
    publications: 'legal_publications',
    suggestions: 'search_suggestions'
  },
  settings: {
    maxResultWindow: 50000,
    defaultSize: 20,
    maxSize: 100
  }
};
