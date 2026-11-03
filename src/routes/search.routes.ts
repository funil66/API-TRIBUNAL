import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validateRequest, validateQuery, validateParams } from '../middlewares/validation.middleware';
import { 
  searchRequestSchema, 
  searchHistoryQuerySchema, 
  searchIdParamSchema 
} from '../validators/search.validator';

const router = Router();
const searchController = new SearchController();

// Protected routes - require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/search:
 *   post:
 *     summary: Criar nova busca
 *     description: Cria uma nova busca utilizando os scrapers tradicionais
 *     tags: [Search - Tradicional]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *               - type
 *             properties:
 *               query:
 *                 type: string
 *                 description: Termo de busca
 *                 example: "João da Silva"
 *               type:
 *                 type: string
 *                 enum: [name, cpf, oab, process, content]
 *                 description: Tipo de busca
 *                 example: "name"
 *               sources:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [tjsp, tjrj, stj]
 *                 description: Fontes de busca
 *                 example: ["tjsp"]
 *     responses:
 *       201:
 *         description: Busca criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Token inválido
 */
router.post('/', validateRequest(searchRequestSchema), searchController.createSearch);

/**
 * @swagger
 * /api/search/semantic:
 *   get:
 *     summary: Busca semântica avançada
 *     description: Realiza busca semântica utilizando Elasticsearch com análise de texto jurídico
 *     tags: [Search - Semântica]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termo de busca
 *         example: "contrato de trabalho"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [name, cpf, oab, process, content]
 *         description: Tipo de busca
 *         example: "content"
 *       - in: query
 *         name: tribunals
 *         schema:
 *           type: string
 *         description: Lista de tribunais separada por vírgula
 *         example: "TJSP,STJ"
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial (YYYY-MM-DD)
 *         example: "2024-01-01"
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final (YYYY-MM-DD)
 *         example: "2024-12-31"
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Número de resultados por página
 *       - in: query
 *         name: from
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Offset para paginação
 *     responses:
 *       200:
 *         description: Busca realizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SemanticSearchResult'
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido
 *       503:
 *         description: Elasticsearch indisponível
 */
router.get('/semantic', searchController.semanticSearch);

/**
 * @swagger
 * /api/search/suggestions:
 *   get:
 *     summary: Obter sugestões de busca
 *     description: Retorna sugestões inteligentes baseadas no histórico e contexto
 *     tags: [Search - Semântica]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Termo parcial para sugestões
 *         example: "contra"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [name, cpf, oab, process, content]
 *         description: Tipo de busca para sugestões contextuais
 *         example: "content"
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *         description: Número de sugestões
 *     responses:
 *       200:
 *         description: Sugestões obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SuggestionsResult'
 *       400:
 *         description: Parâmetros inválidos
 *       401:
 *         description: Token inválido
 */
router.get('/suggestions', searchController.getSuggestions);

/**
 * @swagger
 * /api/search/related/{id}:
 *   get:
 *     summary: Obter publicações relacionadas
 *     description: Encontra publicações similares utilizando análise semântica
 *     tags: [Search - Semântica]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da publicação de referência
 *         example: "pub-123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Número de publicações relacionadas
 *     responses:
 *       200:
 *         description: Publicações relacionadas encontradas
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/RelatedPublicationsResult'
 *       404:
 *         description: Publicação não encontrada
 *       401:
 *         description: Token inválido
 */
router.get('/related/:id', searchController.getRelatedPublications);

/**
 * @swagger
 * /api/search/history:
 *   get:
 *     summary: Obter histórico de buscas
 *     description: Lista o histórico de buscas do usuário autenticado
 *     tags: [Search - Tradicional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Resultados por página
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [name, cpf, oab, process, content]
 *         description: Filtrar por tipo de busca
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *         description: Filtrar por status
 *     responses:
 *       200:
 *         description: Histórico obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         searches:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Search'
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Token inválido
 */
router.get('/history', validateQuery(searchHistoryQuerySchema), searchController.getSearchHistory);

/**
 * @swagger
 * /api/search/stats:
 *   get:
 *     summary: Obter estatísticas de uso
 *     description: Retorna estatísticas das buscas do usuário
 *     tags: [Search - Tradicional]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalSearches:
 *                           type: integer
 *                         searchesByType:
 *                           type: object
 *                         searchesByStatus:
 *                           type: object
 *                         avgResultsPerSearch:
 *                           type: number
 *                         mostSearchedTerms:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               term:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *       401:
 *         description: Token inválido
 */
router.get('/stats', searchController.getSearchStats);

/**
 * @swagger
 * /api/search/{id}:
 *   get:
 *     summary: Obter busca por ID
 *     description: Retorna os detalhes de uma busca específica
 *     tags: [Search - Tradicional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da busca
 *     responses:
 *       200:
 *         description: Busca encontrada
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Search'
 *       404:
 *         description: Busca não encontrada
 *       401:
 *         description: Token inválido
 */
router.get('/:id', validateParams(searchIdParamSchema), searchController.getSearchById);

/**
 * @swagger
 * /api/search/{id}:
 *   delete:
 *     summary: Cancelar busca
 *     description: Cancela uma busca em andamento ou remove do histórico
 *     tags: [Search - Tradicional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da busca
 *     responses:
 *       200:
 *         description: Busca cancelada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Busca não encontrada
 *       401:
 *         description: Token inválido
 */
router.delete('/:id', validateParams(searchIdParamSchema), searchController.cancelSearch);

export default router;