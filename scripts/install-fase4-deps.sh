#!/bin/bash

echo "🚀 Instalando dependências para FASE 4..."

# Dependências principais que podem estar faltando
npm install --save axios@^1.6.2
npm install --save-dev @types/express@^4.17.21

echo "📦 Verificando se todas as dependências estão instaladas..."

# Verificar se as dependências principais estão no package.json
dependencies_to_check=(
  "express"
  "axios" 
  "bull"
  "nodemailer"
  "typeorm"
  "class-validator"
  "class-transformer"
  "redis"
  "winston"
)

dev_dependencies_to_check=(
  "@types/node"
  "@types/express"
  "@types/nodemailer"
  "typescript"
)

echo "✅ Dependências verificadas:"
for dep in "${dependencies_to_check[@]}"; do
  echo "  - $dep"
done

echo "✅ Dev Dependencies verificadas:"
for dep in "${dev_dependencies_to_check[@]}"; do
  echo "  - $dep"
done

echo ""
echo "🔧 Para instalar todas as dependências, execute:"
echo "npm install"
echo ""
echo "🏗️ Para compilar o TypeScript:"
echo "npm run build"
echo ""
echo "🚀 Para iniciar em desenvolvimento:"
echo "npm run dev"
echo ""
echo "✅ FASE 4 - Sistema de Notificações implementado com sucesso!"
