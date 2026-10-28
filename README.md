# Legal Search API 🏛️⚖️

Sistema de alta performance para busca semântica, monitoramento e extração automatizada de publicações jurídicas em Diários de Justiça Eletrônicos (DJE/DJEN) e tribunais estaduais (TJSP).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green?logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org/)
[![Elasticsearch](https://img.shields.io/badge/Elasticsearch-8.11-yellow?logo=elasticsearch)](https://www.elastic.co/)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Visão Geral

A **Legal Search API** é uma solução de engenharia de software voltada para o setor jurídico (LegalTech), construída sobre Node.js e TypeScript com arquitetura orientada a serviços:
- **Indexação & Busca Semântica:** Elasticsearch 8 para busca contextual em publicações judiciais com lematização brasileira e sinônimos jurídicos.
- **Processamento Assíncrono:** Filas distribuídas com Bull e Redis para extração e processamento não-bloqueante de Diários Oficiais.
- **Scraping Resiliente:** Integração Puppeteer para automação em portais de tribunais com controle de concorrência e rotação de headers.
- **Persistência Relacional:** PostgreSQL gerenciado via TypeORM com migrações versionadas.
- **Segurança & Controle:** Autenticação híbrida (JWT + API Keys por tiers), rate limiting por IP/token e documentação Swagger/OpenAPI interativa.

---

## 🚀 Stack Tecnológica

| Camada | Tecnologia | Propósito |
| :--- | :--- | :--- |
| **Runtime & Linguagem** | Node.js 20 LTS + TypeScript 5 | Tipagem estrita e execução assíncrona moderna |
| **Web Framework** | Express.js 4 + Helmet + CORS | Roteamento, segurança HTTP e compressão |
| **Banco Relacional** | PostgreSQL 15 + TypeORM | Entidades, relacionamentos e persistência transacional |
| **Busca Semântica** | Elasticsearch 8.11 | Full-text search, analisadores de morfologia jurídica |
| **Cache & Filas** | Redis 7 + Bull | Gerenciamento de tarefas em background e throttling |
| **Web Scraping** | Puppeteer + Cheerio | Extração estruturada de Diários e intimações |
| **Documentação** | Swagger UI + OpenAPI 3.0 | Especificação interativa de rotas e schemas |

---

## 🏗️ Estrutura do Projeto

```
API-TRIBUNAL/
├── docker/                 # Imagens Docker e scripts de inicialização do PostgreSQL
├── docker-compose.dev.yml  # Orquestração local completa (Postgres, Redis, Elastic, Kibana)
├── docker-compose.yml      # Configuração simplificada de serviços
├── migrations/             # Migrações versionadas de banco de dados
├── scripts/                # Scripts de monitoramento, teste semântico e setup
├── src/
│   ├── config/             # Configurações de banco, cache, Elastic, logger e filas
│   ├── controllers/        # Controladores REST da API
│   ├── middlewares/        # Autenticação JWT, validações Joi/Validator, rate limiting
│   ├── models/             # Entidades TypeORM (User, Search, Monitor, Notification, ApiKey)
│   ├── queues/             # Workers e processadores de tarefas em fila Bull
│   ├── routes/             # Definição modular de rotas da aplicação
│   ├── scrapers/           # Motores de extração especializados (TJSP, DJE, DJEN)
│   ├── services/           # Regras de negócio, busca semântica e notificações
│   ├── types/              # Definições de interfaces e tipos estritos
│   ├── utils/              # Classes utilitárias e tratamento centralizado de erros
│   └── app.ts              # Ponto de entrada e bootstrap da aplicação
└── tests/                  # Testes unitários e de integração (Jest + Supertest)
```

---

## 📡 Endpoints Principais

### Autenticação & Gestão de Acesso
- `POST /api/auth/register` — Criação de conta de usuário
- `POST /api/auth/login` — Autenticação e emissão de pares Access/Refresh Tokens
- `POST /api/auth/refresh` — Rotação segura de tokens JWT
- `POST /api/auth/logout` — Revogação de sessão e invalidação de refresh token

### Busca Processual & Semântica
- `POST /api/search` — Disparo de busca tradicional em Diários
- `GET /api/search/semantic` — Consulta semântica de jurisprudência via Elasticsearch
- `GET /api/search/suggestions` — Sugestões preditivas de termos e partes
- `GET /api/search/history` — Histórico paginado de consultas realizadas
- `GET /api/search/:id` — Consulta detalhada do resultado da busca

### Monitores Contínuos de Publicações
- `POST /api/monitors` — Cadastro de monitoramento contínuo (por OAB, CPF ou termo)
- `GET /api/monitors` — Listagem de monitores ativos do usuário
- `PUT /api/monitors/:id` — Atualização de frequência e parâmetros de alerta
- `DELETE /api/monitors/:id` — Desativação do monitor

### Métricas & Telemetria
- `GET /health` — Healthcheck da API e dos serviços dependentes
- `GET /api-docs` — Swagger UI interativo

---

## 🔧 Como Executar Localmente

### 1. Clonar o Repositório
```bash
git clone https://github.com/funil66/API-TRIBUNAL.git
cd API-TRIBUNAL
```

### 2. Configurar Variáveis de Ambiente
```bash
cp .env.example .env
# Ajuste as credenciais conforme seu ambiente
```

### 3. Subir Serviços Auxiliares via Docker
```bash
docker compose -f docker-compose.dev.yml up -d postgres redis elasticsearch
```

### 4. Instalar Dependências e Executar
```bash
npm install
npm run dev
```

A API estará disponível em `http://localhost:3000` e a documentação Swagger em `http://localhost:3000/api-docs`.

---

## 🧪 Testes Automatizados

```bash
# Testes unitários e de integração
npm test

# Cobertura de código
npm run test:coverage
```

---

## 👤 Autor

**Dr. Allisson Gonçalves de Sousa**  
- Advogado (OAB/SP 390.456) & Engenheiro de Software
- Portfolio / Site Oficial: [allissonsousa.adv.br](https://allissonsousa.adv.br)
- GitHub: [@funil66](https://github.com/funil66)

---

## 📄 Licença

Este projeto está licenciado sob a Licença MIT — consulte o arquivo [LICENSE](LICENSE) para mais detalhes.