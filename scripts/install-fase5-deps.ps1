# PowerShell script para instalar dependências da FASE 5
Write-Host "🚀 Instalando dependências da FASE 5 - API Pública e Documentação" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

# Dependências principais
Write-Host "📦 Instalando dependências principais..." -ForegroundColor Yellow
npm install --save `
  swagger-jsdoc `
  swagger-ui-express `
  helmet `
  cors `
  express-rate-limit `
  express-validator `
  dompurify `
  jsdom `
  js-yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências principais" -ForegroundColor Red
    exit 1
}

# Dependências de desenvolvimento
Write-Host "🔧 Instalando dependências de desenvolvimento..." -ForegroundColor Yellow
npm install --save-dev `
  @types/swagger-jsdoc `
  @types/swagger-ui-express `
  @types/cors `
  @types/dompurify `
  @types/js-yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências de desenvolvimento" -ForegroundColor Red
    exit 1
}

# Dependências opcionais para métricas avançadas
Write-Host "📊 Instalando dependências de métricas..." -ForegroundColor Yellow
npm install --save `
  prom-client `
  express-prometheus-middleware

if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Aviso: Algumas dependências de métricas falharam (opcional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Instalação concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Dependências instaladas:" -ForegroundColor Cyan
Write-Host "   - swagger-jsdoc: Geração automática de documentação OpenAPI"
Write-Host "   - swagger-ui-express: Interface Swagger UI"
Write-Host "   - helmet: Headers de segurança"
Write-Host "   - cors: Configuração CORS"
Write-Host "   - express-rate-limit: Rate limiting"
Write-Host "   - express-validator: Validação de dados"
Write-Host "   - dompurify: Sanitização XSS"
Write-Host "   - prom-client: Métricas Prometheus"
Write-Host ""
Write-Host "🔗 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. npm run build"
Write-Host "   2. npm run start"
Write-Host "   3. Acesse http://localhost:3000/api/docs para ver a documentação"
Write-Host ""
Write-Host "📚 Endpoints disponíveis:" -ForegroundColor Cyan
Write-Host "   - GET /api/docs - Documentação Swagger UI"
Write-Host "   - GET /api/docs/json - Especificação OpenAPI JSON"
Write-Host "   - GET /api/docs/examples - Exemplos de uso"
Write-Host "   - GET /api/health - Health check básico"
Write-Host "   - GET /api/metrics/system - Métricas do sistema"
Write-Host ""
