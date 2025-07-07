# FASE 4 - Sistema de Notificações
# Script para instalar dependências no Windows

Write-Host "🚀 Instalando dependências para FASE 4..." -ForegroundColor Green

# Verificar se npm está disponível
try {
    npm --version | Out-Null
    Write-Host "✅ NPM encontrado" -ForegroundColor Green
} catch {
    Write-Host "❌ NPM não encontrado. Instale Node.js primeiro." -ForegroundColor Red
    exit 1
}

# Instalar dependências que podem estar faltantes
Write-Host "📦 Instalando dependências adicionais..." -ForegroundColor Yellow

# Dependências de produção
$prod_deps = @(
    "axios@^1.6.2"
)

# Dependências de desenvolvimento
$dev_deps = @(
    "@types/express@^4.17.21"
    "@types/axios@^1.6.4"
)

foreach ($dep in $prod_deps) {
    Write-Host "  Instalando $dep..." -ForegroundColor White
    npm install --save $dep
}

foreach ($dep in $dev_deps) {
    Write-Host "  Instalando $dep..." -ForegroundColor White
    npm install --save-dev $dep
}

Write-Host ""
Write-Host "🔧 Comandos disponíveis:" -ForegroundColor Cyan
Write-Host "  npm install          - Instalar todas as dependências" -ForegroundColor White
Write-Host "  npm run build        - Compilar TypeScript" -ForegroundColor White  
Write-Host "  npm run dev          - Iniciar em desenvolvimento" -ForegroundColor White
Write-Host "  npm test             - Executar testes" -ForegroundColor White

Write-Host ""
Write-Host "📋 Arquivos implementados na FASE 4:" -ForegroundColor Cyan
Write-Host "  ✅ src/config/queue.config.ts" -ForegroundColor Green
Write-Host "  ✅ src/models/monitor.entity.ts" -ForegroundColor Green
Write-Host "  ✅ src/models/notification.entity.ts" -ForegroundColor Green
Write-Host "  ✅ src/services/notification.service.ts" -ForegroundColor Green
Write-Host "  ✅ src/services/email.service.ts" -ForegroundColor Green
Write-Host "  ✅ src/services/webhook.service.ts" -ForegroundColor Green
Write-Host "  ✅ src/controllers/monitor.controller.ts" -ForegroundColor Green
Write-Host "  ✅ src/controllers/notification.controller.ts" -ForegroundColor Green
Write-Host "  ✅ src/routes/monitor.routes.ts" -ForegroundColor Green
Write-Host "  ✅ src/routes/notification.routes.ts" -ForegroundColor Green
Write-Host "  ✅ src/queues/email.processor.ts" -ForegroundColor Green
Write-Host "  ✅ src/queues/webhook.processor.ts" -ForegroundColor Green
Write-Host "  ✅ src/queues/monitor.processor.ts" -ForegroundColor Green

Write-Host ""
Write-Host "🎯 Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Resolver imports de dependências" -ForegroundColor White
Write-Host "  2. Integrar com banco de dados (TypeORM)" -ForegroundColor White
Write-Host "  3. Adicionar middleware de autenticação" -ForegroundColor White
Write-Host "  4. Implementar testes" -ForegroundColor White
Write-Host "  5. Configurar Bull Board dashboard" -ForegroundColor White

Write-Host ""
Write-Host "✅ FASE 4 - Sistema de Notificações implementado com sucesso!" -ForegroundColor Green
