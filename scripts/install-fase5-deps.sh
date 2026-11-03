#!/bin/bash

echo "🚀 Instalando dependências da FASE 5 - API Pública e Documentação"
echo "================================================================="

# Dependências principais
echo "📦 Instalando dependências principais..."
npm install --save \
  swagger-jsdoc \
  swagger-ui-express \
  helmet \
  cors \
  express-rate-limit \
  express-validator \
  dompurify \
  jsdom \
  js-yaml

# Dependências de desenvolvimento
echo "🔧 Instalando dependências de desenvolvimento..."
npm install --save-dev \
  @types/swagger-jsdoc \
  @types/swagger-ui-express \
  @types/cors \
  @types/dompurify \
  @types/js-yaml

# Dependências opcionais para métricas avançadas
echo "📊 Instalando dependências de métricas..."
npm install --save \
  prom-client \
  express-prometheus-middleware

echo ""
echo "✅ Instalação concluída!"
echo ""
echo "📝 Dependências instaladas:"
echo "   - swagger-jsdoc: Geração automática de documentação OpenAPI"
echo "   - swagger-ui-express: Interface Swagger UI"
echo "   - helmet: Headers de segurança"
echo "   - cors: Configuração CORS"
echo "   - express-rate-limit: Rate limiting"
echo "   - express-validator: Validação de dados"
echo "   - dompurify: Sanitização XSS"
echo "   - prom-client: Métricas Prometheus"
echo ""
echo "🔗 Próximos passos:"
echo "   1. npm run build"
echo "   2. npm run start"
echo "   3. Acesse http://localhost:3000/api/docs para ver a documentação"
echo ""
echo "📚 Endpoints disponíveis:"
echo "   - GET /api/docs - Documentação Swagger UI"
echo "   - GET /api/docs/json - Especificação OpenAPI JSON"
echo "   - GET /api/docs/examples - Exemplos de uso"
echo "   - GET /api/health - Health check básico"
echo "   - GET /api/metrics/system - Métricas do sistema"
echo ""
