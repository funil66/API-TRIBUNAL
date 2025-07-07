# ====================================
# LEGAL SEARCH API - SETUP SCRIPT (PowerShell)
# ====================================

Write-Host "🚀 Configurando Legal Search API..." -ForegroundColor Green

# Verificar se Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js OK (versão $nodeVersion)" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js não encontrado. Instale Node.js 18+ primeiro." -ForegroundColor Red
    exit 1
}

# Instalar dependências
Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
try {
    npm install
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao instalar dependências" -ForegroundColor Red
    exit 1
}

# Verificar se Docker está disponível
try {
    docker --version | Out-Null
    Write-Host "✅ Docker encontrado" -ForegroundColor Green
    
    try {
        docker-compose --version | Out-Null
        Write-Host "✅ Docker Compose encontrado" -ForegroundColor Green
        Write-Host "🐳 Para executar com Docker: npm run docker:dev" -ForegroundColor Cyan
    } catch {
        Write-Host "⚠️  Docker Compose não encontrado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Docker não encontrado - execução manual apenas" -ForegroundColor Yellow
}

# Criar arquivo .env se não existir
if (-not (Test-Path ".env")) {
    Write-Host "📝 Criando arquivo .env..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Arquivo .env criado - configure as variáveis antes de executar" -ForegroundColor Green
} else {
    Write-Host "✅ Arquivo .env já existe" -ForegroundColor Green
}

# Compilar TypeScript
Write-Host "🔨 Compilando TypeScript..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ Compilação bem-sucedida" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro na compilação TypeScript" -ForegroundColor Red
    Write-Host "💡 Verifique se todas as dependências estão instaladas" -ForegroundColor Cyan
}

# Executar testes
Write-Host "🧪 Executando testes..." -ForegroundColor Yellow
try {
    npm test
    Write-Host "✅ Todos os testes passaram" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Alguns testes falharam - verifique a configuração" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup concluído com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Configure o arquivo .env com suas credenciais" -ForegroundColor White
Write-Host "2. Execute 'npm run dev' para desenvolvimento" -ForegroundColor White
Write-Host "3. Execute 'npm run docker:dev' para usar Docker" -ForegroundColor White
Write-Host "4. Acesse http://localhost:3000 para a API" -ForegroundColor White
Write-Host "5. Abra fruitkha-1.0.0/index.html para a landing page" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentação:" -ForegroundColor Cyan
Write-Host "- README.md - Documentação principal" -ForegroundColor White
Write-Host "- LANDING-PAGE-COMPLETA.md - Detalhes da landing page" -ForegroundColor White
Write-Host "- ANALISE-PROJETO.md - Análise do projeto" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Landing Page: file:///$PWD/fruitkha-1.0.0/index.html" -ForegroundColor Magenta
