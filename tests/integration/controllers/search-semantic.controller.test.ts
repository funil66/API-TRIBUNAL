import request from 'supertest';
import { app } from '../../../src/app';
import { AppDataSource } from '../../../src/config/database.config';
import { ElasticsearchService } from '../../../src/services/elasticsearch.service';
import { User } from '../../../src/models/user.entity';
import jwt from 'jsonwebtoken';
import { appConfig } from '../../../src/config/app.config';

describe('Search Semantic Controller', () => {
  let authToken: string;
  let testUser: User;
  let elasticsearchService: ElasticsearchService;

  beforeAll(async () => {
    await AppDataSource.initialize();
    elasticsearchService = new ElasticsearchService();
    
    // Aguardar Elasticsearch estar pronto
    let attempts = 0;
    while (attempts < 30) {
      try {
        await elasticsearchService.ping();
        break;
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Criar usuário de teste
    const userRepository = AppDataSource.getRepository(User);
    testUser = userRepository.create({
      email: 'test@example.com',
      name: 'Test User',
      cpf: '12345678901',
      oab: 'SP123456',
      password: 'hashed_password',
      isActive: true,
      subscriptionType: 'premium'
    });
    await userRepository.save(testUser);

    // Gerar token JWT
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      appConfig.jwt.secret,
      { expiresIn: '1h' }
    );

    // Indexar dados de teste
    await setupTestData();
  });

  afterAll(async () => {
    // Limpar dados de teste
    await cleanupTestData();
    await AppDataSource.destroy();
  });

  describe('GET /api/search/semantic', () => {
    it('should perform semantic search successfully', async () => {
      const response = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'contrato de trabalho',
          type: 'content',
          size: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('took');
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('query');
    });

    it('should filter by tribunals correctly', async () => {
      const response = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'direito civil',
          tribunals: 'TJSP,STJ'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verificar se apenas resultados dos tribunais especificados foram retornados
      const results = response.body.data.results;
      results.forEach((result: any) => {
        expect(['TJSP', 'STJ']).toContain(result.source?.tribunal);
      });
    });

    it('should filter by date range correctly', async () => {
      const response = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'processo',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verificar se resultados estão dentro do período especificado
      const results = response.body.data.results;
      results.forEach((result: any) => {
        const publishDate = new Date(result.publishDate);
        expect(publishDate).toBeInstanceOf(Date);
        expect(publishDate >= new Date('2024-01-01')).toBe(true);
        expect(publishDate <= new Date('2024-12-31')).toBe(true);
      });
    });

    it('should handle pagination correctly', async () => {
      const firstPage = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'direito',
          size: 5,
          from: 0
        });

      const secondPage = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'direito',
          size: 5,
          from: 5
        });

      expect(firstPage.status).toBe(200);
      expect(secondPage.status).toBe(200);
      
      // Verificar se as páginas são diferentes
      const firstResults = firstPage.body.data.results.map((r: any) => r.id);
      const secondResults = secondPage.body.data.results.map((r: any) => r.id);
      expect(firstResults).not.toEqual(secondResults);
    });
  });

  describe('GET /api/search/suggestions', () => {
    it('should return search suggestions successfully', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'contra',
          size: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should filter suggestions by type', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          q: 'adv',
          type: 'name',
          size: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toBeDefined();
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/search/suggestions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/search/related/:id', () => {
    let testPublicationId: string;

    beforeAll(async () => {
      // Criar uma publicação de teste e obter seu ID
      const searchResponse = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ q: 'teste', size: 1 });

      if (searchResponse.body.data.results.length > 0) {
        testPublicationId = searchResponse.body.data.results[0].id;
      }
    });

    it('should return related publications successfully', async () => {
      if (!testPublicationId) {
        console.log('Skipping test: no test publication available');
        return;
      }

      const response = await request(app)
        .get(`/api/search/related/${testPublicationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ size: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('related');
      expect(Array.isArray(response.body.data.related)).toBe(true);
    });

    it('should return 404 for non-existent publication', async () => {
      const response = await request(app)
        .get('/api/search/related/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/search/semantic')
        .query({ q: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/search/semantic')
        .set('Authorization', 'Bearer invalid-token')
        .query({ q: 'test' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  // Helper functions
  async function setupTestData() {
    try {
      // Criar alguns documentos de teste no Elasticsearch
      const testPublications = [
        {
          id: 'test-1',
          title: 'Contrato de Trabalho - Direitos do Trabalhador',
          content: 'Este documento trata sobre os direitos fundamentais do trabalhador brasileiro conforme a CLT.',
          publishDate: '2024-01-15',
          tribunal: 'TJSP',
          category: 'Trabalhista',
          url: 'https://example.com/doc1'
        },
        {
          id: 'test-2',
          title: 'Processo Civil - Procedimento Ordinário',
          content: 'Análise do procedimento ordinário no novo código de processo civil.',
          publishDate: '2024-02-20',
          tribunal: 'STJ',
          category: 'Civil',
          url: 'https://example.com/doc2'
        },
        {
          id: 'test-3',
          title: 'Advogado João Silva - OAB/SP 123456',
          content: 'Publicação sobre atuação do advogado João Silva em caso de direito civil.',
          publishDate: '2024-03-10',
          tribunal: 'TJSP',
          category: 'Profissional',
          url: 'https://example.com/doc3'
        }
      ];

      // Indexar documentos no Elasticsearch
      for (const doc of testPublications) {
        await elasticsearchService.indexPublication(doc);
      }

      // Aguardar indexação
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.warn('Error setting up test data:', error);
    }
  }

  async function cleanupTestData() {
    try {
      // Remover dados de teste do Elasticsearch
      const testIds = ['test-1', 'test-2', 'test-3'];
      for (const id of testIds) {
        try {
          await elasticsearchService.deletePublication(id);
        } catch (error) {
          // Ignorar erros de documentos não encontrados
        }
      }

      // Remover usuário de teste
      const userRepository = AppDataSource.getRepository(User);
      await userRepository.delete({ email: 'test@example.com' });
    } catch (error) {
      console.warn('Error cleaning up test data:', error);
    }
  }
});
