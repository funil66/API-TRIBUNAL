import swaggerJsdoc from 'swagger-jsdoc';
import { appConfig } from './app.config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Legal Search API',
      version: '1.0.0',
      description: `
        Sistema de busca e monitoramento de publicações jurídicas em DJE e DJEN com busca semântica avançada.
        
        ## Funcionalidades
        
        ### FASE 1: Fundação
        - ✅ Autenticação JWT com refresh tokens
        - ✅ Estrutura TypeORM com PostgreSQL
        - ✅ Cache Redis para performance
        - ✅ Middleware de validação e logs
        - ✅ Docker e Docker Compose
        
        ### FASE 2: Busca Básica
        - ✅ Scrapers para TJSP e outros tribunais
        - ✅ Validação de CPF/OAB
        - ✅ Cache de resultados
        - ✅ Histórico de buscas
        - ✅ Estatísticas de uso
        
        ### FASE 3: Busca Semântica
        - ✅ Elasticsearch com análise de texto jurídico
        - ✅ Busca híbrida (exact + semantic + fuzzy)
        - ✅ Sistema de sugestões inteligentes
        - ✅ Publicações relacionadas
        - ✅ Agregações e filtros avançados
        
        ### FASE 4: Sistema de Notificações
        - ✅ Monitoramento inteligente de publicações
        - ✅ Notificações por email, webhook e push
        - ✅ Sistema de filas com Bull/Redis
        - ✅ Templates de email personalizáveis
        - ✅ Webhooks com retry e HMAC
        
        ### FASE 5: API Pública e Documentação
        - ✅ Sistema de API keys com tiers
        - ✅ Rate limiting inteligente
        - ✅ Documentação OpenAPI completa
        - ✅ Segurança avançada (CORS, Helmet)
        - ✅ Monitoramento e métricas
        
        ## 🔑 Autenticação
        
        Esta API usa sistema híbrido de autenticação:
        - **JWT Tokens**: Para usuários registrados
        - **API Keys**: Para integração externa
        
        ### API Keys
        Inclua sua API key no header: X-API-Key
        
        ### Tiers de API Key
        - **FREE**: 100 requisições/hora
        - **BASIC**: 500 requisições/hora
        - **PRO**: 1.000 requisições/hora
        - **ENTERPRISE**: 10.000 requisições/hora
        
        ## 🔒 Rate Limiting
        
        Headers de resposta incluem informações sobre limites de uso.
      `,
      contact: {
        name: 'Legal Search Team',
        email: 'support@legalsearch.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${appConfig.port}`,
        description: 'Servidor de desenvolvimento',
      },
      {
        url: 'https://api.legalsearch.com',
        description: 'Servidor de produção',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtido através do endpoint /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            cpf: { type: 'string', pattern: '^\\d{11}$' },
            oab: { type: 'string', pattern: '^[A-Z]{2}\\d{4,6}$' },
            subscriptionType: { 
              type: 'string', 
              enum: ['free', 'basic', 'premium'],
              description: 'Tipo de assinatura do usuário'
            },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Publication: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string', description: 'Título da publicação' },
            content: { type: 'string', description: 'Conteúdo completo da publicação' },
            summary: { type: 'string', description: 'Resumo automático da publicação' },
            parties: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Partes envolvidas no processo'
            },
            publishDate: { type: 'string', format: 'date', description: 'Data de publicação' },
            tribunal: { 
              type: 'string', 
              enum: ['TJSP', 'TJRJ', 'TJMG', 'STJ', 'STF'],
              description: 'Tribunal de origem'
            },
            category: { 
              type: 'string',
              enum: ['Civil', 'Criminal', 'Trabalhista', 'Administrativo', 'Tributário'],
              description: 'Categoria jurídica'
            },
            url: { type: 'string', format: 'uri', description: 'URL original da publicação' },
            type: { 
              type: 'string',
              enum: ['publication', 'jurisprudence', 'legislation'],
              description: 'Tipo de documento'
            },
            score: { 
              type: 'number', 
              description: 'Score de relevância da busca (apenas em resultados de busca)'
            },
            highlights: {
              type: 'object',
              description: 'Trechos destacados da busca',
              properties: {
                content: { type: 'array', items: { type: 'string' } },
                parties: { type: 'array', items: { type: 'string' } },
                summary: { type: 'array', items: { type: 'string' } },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Search: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            query: { type: 'string', description: 'Termo de busca' },
            type: { 
              type: 'string',
              enum: ['name', 'cpf', 'oab', 'process', 'content'],
              description: 'Tipo de busca realizada'
            },
            filters: {
              type: 'object',
              description: 'Filtros aplicados na busca',
              properties: {
                tribunals: { type: 'array', items: { type: 'string' } },
                dateFrom: { type: 'string', format: 'date' },
                dateTo: { type: 'string', format: 'date' },
                category: { type: 'string' },
              },
            },
            results: { type: 'array', items: { $ref: '#/components/schemas/Publication' } },
            totalResults: { type: 'integer', description: 'Total de resultados encontrados' },
            status: { 
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              description: 'Status da busca'
            },
            sources: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Fontes consultadas na busca'
            },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        SemanticSearchResult: {
          type: 'object',
          properties: {
            results: { 
              type: 'array', 
              items: { $ref: '#/components/schemas/Publication' },
              description: 'Publicações encontradas'
            },
            total: { 
              type: 'integer', 
              description: 'Total de resultados encontrados'
            },
            took: { 
              type: 'integer', 
              description: 'Tempo de execução da busca em milissegundos'
            },
            aggregations: {
              type: 'object',
              description: 'Agregações dos resultados',
              properties: {
                tribunals: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      count: { type: 'integer' },
                    },
                  },
                },
                dates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      count: { type: 'integer' },
                    },
                  },
                },
                categories: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      count: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
        SuggestionsResult: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'string' },
              description: 'Lista de sugestões de busca'
            },
            query: { 
              type: 'string',
              description: 'Termo usado para gerar as sugestões'
            },
          },
        },
        RelatedPublicationsResult: {
          type: 'object',
          properties: {
            related: {
              type: 'array',
              items: { $ref: '#/components/schemas/Publication' },
              description: 'Publicações relacionadas'
            },
            originalId: {
              type: 'string',
              description: 'ID da publicação original'
            },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        // FASE 5: API Keys e Documentação
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID único da API key' },
            name: { type: 'string', description: 'Nome identificador' },
            displayKey: { type: 'string', description: 'Chave parcialmente mascarada' },
            tier: { 
              type: 'string', 
              enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
              description: 'Tier da API key' 
            },
            status: { 
              type: 'string', 
              enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
              description: 'Status da API key' 
            },
            usage: {
              type: 'object',
              properties: {
                totalRequests: { type: 'integer' },
                requestsToday: { type: 'integer' },
                requestsThisMonth: { type: 'integer' }
              }
            },
            rateLimits: {
              type: 'object',
              properties: {
                perMinute: { type: 'integer' },
                perDay: { type: 'integer' },
                perMonth: { type: 'integer' }
              }
            },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time' }
          }
        },
        CreateApiKeyRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { 
              type: 'string', 
              minLength: 1, 
              maxLength: 100,
              description: 'Nome identificador da API key' 
            },
            tier: { 
              type: 'string', 
              enum: ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'],
              default: 'FREE' 
            },
            expiresAt: { 
              type: 'string', 
              format: 'date-time',
              description: 'Data de expiração (opcional)' 
            }
          }
        },
        Monitor: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID único do monitor' },
            name: { type: 'string', description: 'Nome do monitor' },
            query: { $ref: '#/components/schemas/SearchParams' },
            isActive: { type: 'boolean', description: 'Status do monitor' },
            frequency: { 
              type: 'string', 
              enum: ['REAL_TIME', 'HOURLY', 'DAILY', 'WEEKLY'] 
            },
            notificationMethods: {
              type: 'array',
              items: { 
                type: 'string', 
                enum: ['EMAIL', 'WEBHOOK', 'PUSH'] 
              }
            },
            lastRun: { type: 'string', format: 'date-time' },
            nextRun: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        CreateMonitorRequest: {
          type: 'object',
          required: ['name', 'query', 'frequency'],
          properties: {
            name: { 
              type: 'string', 
              minLength: 1, 
              maxLength: 100 
            },
            query: { $ref: '#/components/schemas/SearchParams' },
            frequency: { 
              type: 'string', 
              enum: ['REAL_TIME', 'HOURLY', 'DAILY', 'WEEKLY'] 
            },
            notificationMethods: {
              type: 'array',
              items: { 
                type: 'string', 
                enum: ['EMAIL', 'WEBHOOK', 'PUSH'] 
              },
              minItems: 1
            },
            emailNotifications: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean', default: true },
                emails: {
                  type: 'array',
                  items: { type: 'string', format: 'email' }
                }
              }
            },
            webhookNotifications: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean', default: false },
                url: { type: 'string', format: 'uri' },
                secret: { type: 'string' }
              }
            }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { 
              type: 'string', 
              enum: ['MONITOR_RESULT', 'SYSTEM_ALERT', 'ACCOUNT_UPDATE'] 
            },
            title: { type: 'string' },
            message: { type: 'string' },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            metadata: { type: 'object' }
          }
        },
        RateLimitError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Rate limit exceeded' },
            code: { type: 'string', example: 'RATE_LIMIT_EXCEEDED' },
            details: {
              type: 'object',
              properties: {
                limit: { type: 'integer' },
                window: { type: 'string' },
                retryAfter: { type: 'integer' }
              }
            }
          }
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
