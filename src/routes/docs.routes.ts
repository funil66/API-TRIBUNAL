import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger.config';
import { apiKeyMiddleware } from '../middlewares/api-key.middleware';

const router = Router();

/**
 * @swagger
 * /api/docs:
 *   get:
 *     tags: [Documentation]
 *     summary: API Documentation
 *     description: Documentação interativa da API Legal Search
 *     responses:
 *       200:
 *         description: Documentação da API
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */

// Configuração do Swagger UI
const swaggerOptions = {
  explorer: true,
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info hgroup.main h2 { color: #2c3e50; }
    .swagger-ui .scheme-container { 
      background: #f8f9fa; 
      border: 1px solid #dee2e6; 
      padding: 20px; 
      border-radius: 5px; 
      margin: 20px 0; 
    }
  `,
  customSiteTitle: 'Legal Search API - Documentação',
  customfavIcon: '/assets/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true
  }
};

// Servir documentação Swagger
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerSpec, swaggerOptions));

// Especificação OpenAPI em JSON
router.get('/docs/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Especificação OpenAPI em YAML
router.get('/docs/yaml', (req, res) => {
  const yaml = require('js-yaml');
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yaml.dump(swaggerSpec));
});

/**
 * @swagger
 * /api/docs/examples:
 *   get:
 *     tags: [Documentation]
 *     summary: Exemplos de uso da API
 *     description: Exemplos práticos de como usar a API
 *     responses:
 *       200:
 *         description: Exemplos de uso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 examples:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/docs/examples', (req, res) => {
  const examples = {
    examples: [
      {
        title: 'Busca Simples',
        description: 'Como fazer uma busca básica por termos',
        method: 'POST',
        endpoint: '/api/search',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'sua_api_key_aqui'
        },
        body: {
          query: 'contrato administrativo',
          tribunals: ['TJSP'],
          limit: 10
        },
        response: {
          results: [
            {
              id: '123',
              title: 'Contrato Administrativo - Decisão',
              content: 'Decisão sobre contrato administrativo...',
              tribunal: 'TJSP',
              publishedAt: '2024-01-15T10:00:00Z'
            }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 100,
            totalPages: 10
          }
        }
      },
      {
        title: 'Criar Monitor',
        description: 'Como criar um monitor para receber alertas',
        method: 'POST',
        endpoint: '/api/monitors',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'sua_api_key_aqui'
        },
        body: {
          name: 'Monitor Contratos',
          query: {
            query: 'contrato público',
            tribunals: ['TJSP', 'TJRJ']
          },
          frequency: 'DAILY',
          notificationMethods: ['EMAIL'],
          emailNotifications: {
            enabled: true,
            emails: ['usuario@exemplo.com']
          }
        },
        response: {
          id: 'mon_123',
          name: 'Monitor Contratos',
          isActive: true,
          createdAt: '2024-01-15T10:00:00Z'
        }
      },
      {
        title: 'Gerenciar API Keys',
        description: 'Como criar e gerenciar API keys',
        method: 'POST',
        endpoint: '/api/api-keys',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer jwt_token_here'
        },
        body: {
          name: 'Minha API Key',
          tier: 'PRO'
        },
        response: {
          apiKey: {
            id: 'key_123',
            name: 'Minha API Key',
            key: 'ls_pro_1234567890abcdef...',
            displayKey: 'ls_pro_...cdef',
            tier: 'PRO',
            status: 'ACTIVE'
          }
        }
      },
      {
        title: 'Rate Limiting',
        description: 'Como verificar limites de uso',
        method: 'GET',
        endpoint: '/api/search',
        headers: {
          'X-API-Key': 'sua_api_key_aqui'
        },
        responseHeaders: {
          'X-RateLimit-Limit': '1000',
          'X-RateLimit-Remaining': '950',
          'X-RateLimit-Reset': '2024-01-15T11:00:00Z'
        }
      }
    ],
    sdks: {
      nodejs: {
        installation: 'npm install legal-search-sdk',
        usage: `
const { LegalSearchClient } = require('legal-search-sdk');

const client = new LegalSearchClient({
  apiKey: 'sua_api_key_aqui',
  baseUrl: 'https://api.legalsearch.com.br'
});

// Fazer uma busca
const results = await client.search({
  query: 'contrato administrativo',
  tribunals: ['TJSP'],
  limit: 10
});

// Criar um monitor
const monitor = await client.createMonitor({
  name: 'Monitor Contratos',
  query: { query: 'contrato público' },
  frequency: 'DAILY',
  notificationMethods: ['EMAIL']
});
        `
      },
      python: {
        installation: 'pip install legal-search-sdk',
        usage: `
from legal_search import LegalSearchClient

client = LegalSearchClient(
    api_key='sua_api_key_aqui',
    base_url='https://api.legalsearch.com.br'
)

# Fazer uma busca
results = client.search(
    query='contrato administrativo',
    tribunals=['TJSP'],
    limit=10
)

# Criar um monitor
monitor = client.create_monitor(
    name='Monitor Contratos',
    query={'query': 'contrato público'},
    frequency='DAILY',
    notification_methods=['EMAIL']
)
        `
      }
    },
    webhooks: {
      title: 'Configuração de Webhooks',
      description: 'Como configurar webhooks para receber notificações',
      setup: {
        url: 'https://seu-site.com/webhook',
        secret: 'seu_secret_webhook',
        headers: {
          'User-Agent': 'LegalSearch-Webhook/1.0'
        }
      },
      payload: {
        id: 'notif_123',
        type: 'MONITOR_RESULT',
        monitor: {
          id: 'mon_123',
          name: 'Monitor Contratos'
        },
        results: [
          {
            id: '456',
            title: 'Nova Publicação Encontrada',
            tribunal: 'TJSP',
            publishedAt: '2024-01-15T10:00:00Z'
          }
        ],
        timestamp: '2024-01-15T10:05:00Z',
        signature: 'sha256=...'
      },
      verification: `
// Verificar assinatura do webhook (Node.js)
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const calculated = 'sha256=' + hmac.digest('hex');
  return calculated === signature;
}
      `
    }
  };

  res.json(examples);
});

/**
 * @swagger
 * /api/docs/postman:
 *   get:
 *     tags: [Documentation]
 *     summary: Collection do Postman
 *     description: Download da collection do Postman para testar a API
 *     responses:
 *       200:
 *         description: Collection do Postman
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/docs/postman', (req, res) => {
  const postmanCollection = {
    info: {
      name: 'Legal Search API',
      description: 'Collection completa da API Legal Search',
      version: '1.0.0',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'apikey',
      apikey: [
        { key: 'key', value: 'X-API-Key' },
        { key: 'value', value: '{{api_key}}' },
        { key: 'in', value: 'header' }
      ]
    },
    variable: [
      { key: 'base_url', value: 'http://localhost:3000/api' },
      { key: 'api_key', value: 'sua_api_key_aqui' }
    ],
    item: [
      {
        name: 'Search',
        item: [
          {
            name: 'Busca Simples',
            request: {
              method: 'POST',
              header: [
                { key: 'Content-Type', value: 'application/json' }
              ],
              url: '{{base_url}}/search',
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  query: 'contrato administrativo',
                  tribunals: ['TJSP'],
                  limit: 10
                }, null, 2)
              }
            }
          }
        ]
      },
      {
        name: 'Monitors',
        item: [
          {
            name: 'Criar Monitor',
            request: {
              method: 'POST',
              header: [
                { key: 'Content-Type', value: 'application/json' }
              ],
              url: '{{base_url}}/monitors',
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  name: 'Monitor Teste',
                  query: { query: 'contrato' },
                  frequency: 'DAILY',
                  notificationMethods: ['EMAIL']
                }, null, 2)
              }
            }
          },
          {
            name: 'Listar Monitors',
            request: {
              method: 'GET',
              url: '{{base_url}}/monitors'
            }
          }
        ]
      },
      {
        name: 'API Keys',
        item: [
          {
            name: 'Criar API Key',
            request: {
              method: 'POST',
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Authorization', value: 'Bearer {{jwt_token}}' }
              ],
              url: '{{base_url}}/api-keys',
              body: {
                mode: 'raw',
                raw: JSON.stringify({
                  name: 'Minha API Key',
                  tier: 'FREE'
                }, null, 2)
              }
            }
          }
        ]
      }
    ]
  };

  res.setHeader('Content-Disposition', 'attachment; filename="legal-search-api.postman_collection.json"');
  res.json(postmanCollection);
});

export default router;
