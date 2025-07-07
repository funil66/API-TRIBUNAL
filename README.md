# Legal Search API 🏛️⚖️

## 🎯 Visão Geral

**Legal Search API** é uma solução completa de busca e monitoramento de publicações jurídicas em Diários de Justiça Eletrônicos (DJE/DJEN), desenvolvida com Node.js, TypeScript e arquitetura escalável.

## 🚀 Tecnologias

- **Node.js** com TypeScript
- **Express.js** - Framework web
- **PostgreSQL** - Banco de dados principal
- **Redis** - Cache e filas
- **Elasticsearch** - Busca semântica
- **Puppeteer** - Web scraping
- **Bull** - Processamento de filas
- **JWT** - Autenticação
- **Docker** - Containerização

## 📋 Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- Git

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/funil66/API-TRIBUNAL.git
cd API-TRIBUNAL
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie os serviços com Docker:
```bash
docker-compose up -d
```

5. Execute as migrações:
```bash
npm run db:migrate
```

6. Inicie a aplicação:
```bash
npm run dev
```

## 🏗️ Estrutura do Projeto

```
src/
├── config/         # Configurações (database, redis, etc)
├── controllers/    # Controladores da API
├── services/       # Lógica de negócio
├── models/         # Modelos do banco de dados
├── routes/         # Rotas da API
├── middlewares/    # Middlewares personalizados
├── utils/          # Utilitários
├── types/          # Definições TypeScript
├── scrapers/       # Web scrapers
└── queues/         # Processadores de filas
```

## 📡 API Endpoints

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Logout

### Busca
- `POST /api/search` - Realizar busca
- `GET /api/search/history` - Histórico de buscas
- `GET /api/search/:id` - Detalhes de uma busca
- `GET /api/search/semantic` - Busca semântica

### Monitores
- `GET /api/monitors` - Listar monitores
- `POST /api/monitors` - Criar monitor
- `PUT /api/monitors/:id` - Atualizar monitor
- `DELETE /api/monitors/:id` - Excluir monitor

### Notificações
- `GET /api/notifications` - Listar notificações
- `POST /api/notifications/test` - Testar notificação
- `PUT /api/notifications/:id/read` - Marcar como lida

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes com coverage
npm run test:coverage

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e
```

## 🐳 Docker

O projeto inclui um `docker-compose.yml` com:
- PostgreSQL
- Redis
- Elasticsearch

## 🚀 Deploy

Para deploy em produção:

```bash
npm run build
npm start
```

## � Licença

Este projeto está sob a licença MIT.

## 👥 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Contato

GitHub: [@funil66](https://github.com/funil66)
│   ├── unit
│   │   └── services
│   └── integration
│       └── controllers
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── docker-compose.yml
└── README.md
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd legal-search-api
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Set up environment variables by copying `.env.example` to `.env` and updating the values as needed.

## Usage
1. Start the application:
   ```
   npm start
   ```
2. Access the API at `http://localhost:3000`.

## API Endpoints
- **Authentication**
  - `POST /api/auth/login`: User login
  - `POST /api/auth/register`: User registration

- **Search**
  - `GET /api/search`: Search for publications by name, CPF, or OAB number

- **Subscription**
  - `POST /api/subscription`: Create a new subscription
  - `GET /api/subscription`: Manage subscriptions

- **Admin**
  - `GET /api/admin/users`: View all users
  - `GET /api/admin/statistics`: View subscription statistics

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any suggestions or improvements.

## License
This project is licensed under the MIT License. See the LICENSE file for details.