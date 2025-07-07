#!/bin/bash

# ====================================
# LEGAL SEARCH API - SETUP SCRIPT
# ====================================

echo "🚀 Configurando Legal Search API..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi

# Verificar versão do Node.js
NODE_VERSION=$(node -v | cut -c 2-)
if [ "$(echo "$NODE_VERSION 18.0.0" | tr " " "\n" | sort -V | head -n1)" != "18.0.0" ]; then
    echo "❌ Node.js 18+ é necessário. Versão atual: $NODE_VERSION"
    exit 1
fi

echo "✅ Node.js OK (versão $NODE_VERSION)"

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo "✅ Dependências instaladas"

# Verificar se Docker está disponível
if command -v docker &> /dev/null; then
    echo "✅ Docker encontrado"
    
    # Verificar se docker-compose está disponível
    if command -v docker-compose &> /dev/null; then
        echo "✅ Docker Compose encontrado"
        echo "🐳 Para executar com Docker: npm run docker:dev"
    fi
else
    echo "⚠️  Docker não encontrado - execução manual apenas"
fi

# Criar arquivo .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "✅ Arquivo .env criado - configure as variáveis antes de executar"
else
    echo "✅ Arquivo .env já existe"
fi

# Compilar TypeScript
echo "🔨 Compilando TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Erro na compilação TypeScript"
    echo "💡 Execute 'npm install' primeiro"
    exit 1
fi

echo "✅ Compilação bem-sucedida"

# Executar testes
echo "🧪 Executando testes..."
npm test

if [ $? -ne 0 ]; then
    echo "⚠️  Alguns testes falharam - verifique a configuração"
else
    echo "✅ Todos os testes passaram"
fi

echo ""
echo "🎉 Setup concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o arquivo .env com suas credenciais"
echo "2. Execute 'npm run dev' para desenvolvimento"
echo "3. Execute 'npm run docker:dev' para usar Docker"
echo "4. Acesse http://localhost:3000 para a API"
echo "5. Abra fruitkha-1.0.0/index.html para a landing page"
echo ""
echo "📚 Documentação:"
echo "- README.md - Documentação principal"
echo "- LANDING-PAGE-COMPLETA.md - Detalhes da landing page"
echo "- ANALISE-PROJETO.md - Análise do projeto"
echo ""
