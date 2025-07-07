# SCRIPT PARA FAZER PUSH PARA O GITHUB
# Execute este script após instalar o Git

# 1. Inicializar repositório Git
git init

# 2. Adicionar remote do GitHub
git remote add origin https://github.com/funil66/API-TRIBUNAL.git

# 3. Adicionar todos os arquivos
git add .

# 4. Fazer primeiro commit
git commit -m "feat: Initial commit - Legal Search API complete implementation

- Complete Node.js + TypeScript API implementation
- PostgreSQL + Redis + Elasticsearch integration
- Authentication with JWT
- Search functionality for legal publications
- Monitoring and notification system
- Docker containerization
- Comprehensive test suite
- API documentation with Swagger"

# 5. Configurar branch principal
git branch -M main

# 6. Fazer push para o GitHub
git push -u origin main

Write-Host "✅ Push concluído com sucesso!" -ForegroundColor Green
Write-Host "🔗 Repositório: https://github.com/funil66/API-TRIBUNAL" -ForegroundColor Cyan
