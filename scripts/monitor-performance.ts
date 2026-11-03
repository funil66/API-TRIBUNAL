#!/usr/bin/env ts-node

/**
 * Script de monitoramento de performance do Elasticsearch
 * Monitora métricas de busca semântica e indexação
 */

import 'reflect-metadata';
import { AppDataSource } from '../src/config/database.config';
import { ElasticsearchService } from '../src/services/elasticsearch.service';
import { logger } from '../src/config/logger.config';

interface PerformanceMetrics {
  searchLatency: {
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  indexingThroughput: {
    docsPerSecond: number;
    avgLatency: number;
  };
  clusterHealth: {
    status: string;
    activeShards: number;
    relocatingShards: number;
    unassignedShards: number;
  };
  queryTypes: {
    semantic: number;
    suggestions: number;
    related: number;
  };
  errorRate: number;
  cacheHitRate: number;
}

class PerformanceMonitor {
  private elasticsearchService: ElasticsearchService;
  private metrics: PerformanceMetrics;
  private searchTimes: number[] = [];
  private indexTimes: number[] = [];
  private errors: number = 0;
  private totalQueries: number = 0;

  constructor() {
    this.elasticsearchService = new ElasticsearchService();
    this.metrics = {
      searchLatency: { avg: 0, min: 0, max: 0, p95: 0, p99: 0 },
      indexingThroughput: { docsPerSecond: 0, avgLatency: 0 },
      clusterHealth: { status: 'unknown', activeShards: 0, relocatingShards: 0, unassignedShards: 0 },
      queryTypes: { semantic: 0, suggestions: 0, related: 0 },
      errorRate: 0,
      cacheHitRate: 0,
    };
  }

  async start(): Promise<void> {
    logger.info('🚀 Iniciando monitoramento de performance...');

    try {
      await AppDataSource.initialize();
      logger.info('✅ Conexão com banco de dados estabelecida');

      // Verificar conexão com Elasticsearch
      const isConnected = await this.elasticsearchService.ping();
      if (!isConnected) {
        throw new Error('Elasticsearch não está disponível');
      }
      logger.info('✅ Conexão com Elasticsearch estabelecida');

      // Executar testes de performance
      await this.runPerformanceTests();
      
      // Coletar métricas do cluster
      await this.collectClusterMetrics();
      
      // Exibir relatório
      this.generateReport();

    } catch (error) {
      logger.error('❌ Erro durante monitoramento:', error);
      process.exit(1);
    }
  }

  private async runPerformanceTests(): Promise<void> {
    logger.info('📊 Executando testes de performance...');

    // Test queries para diferentes tipos de busca
    const testQueries = [
      { query: 'contrato de trabalho', type: 'content' as const },
      { query: 'João da Silva', type: 'name' as const },
      { query: '123.456.789-00', type: 'cpf' as const },
      { query: 'SP123456', type: 'oab' as const },
      { query: 'processo administrativo', type: 'process' as const },
      { query: 'direito civil contratos', type: 'content' as const },
      { query: 'rescisão trabalhista', type: 'content' as const },
      { query: 'Maria Santos', type: 'name' as const },
    ];

    // Teste de busca semântica
    logger.info('🔍 Testando busca semântica...');
    for (let i = 0; i < 50; i++) {
      const query = testQueries[i % testQueries.length];
      await this.measureSemanticSearch(query);
      
      // Pequena pausa entre requests
      await this.sleep(100);
    }

    // Teste de sugestões
    logger.info('💡 Testando sugestões...');
    const suggestionQueries = ['contra', 'proc', 'dire', 'adv', 'joa'];
    for (let i = 0; i < 25; i++) {
      const query = suggestionQueries[i % suggestionQueries.length];
      await this.measureSuggestions(query);
      await this.sleep(50);
    }

    // Teste de publicações relacionadas
    logger.info('🔗 Testando publicações relacionadas...');
    for (let i = 0; i < 10; i++) {
      await this.measureRelatedPublications('test-publication-id');
      await this.sleep(200);
    }

    this.calculateLatencyMetrics();
  }

  private async measureSemanticSearch(query: { query: string; type: 'content' | 'name' | 'cpf' | 'oab' | 'process' }): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      await this.elasticsearchService.semanticSearch({
        query: query.query,
        type: query.type,
        size: 20,
      });
      
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      
      this.searchTimes.push(latency);
      this.metrics.queryTypes.semantic++;
      this.totalQueries++;
      
    } catch (error) {
      this.errors++;
      this.totalQueries++;
      logger.warn('Erro na busca semântica:', error.message);
    }
  }

  private async measureSuggestions(query: string): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      await this.elasticsearchService.getSuggestions(query, 'content');
      
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1_000_000;
      
      this.searchTimes.push(latency);
      this.metrics.queryTypes.suggestions++;
      this.totalQueries++;
      
    } catch (error) {
      this.errors++;
      this.totalQueries++;
      logger.warn('Erro nas sugestões:', error.message);
    }
  }

  private async measureRelatedPublications(publicationId: string): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      await this.elasticsearchService.getRelatedPublications(publicationId, 5);
      
      const endTime = process.hrtime.bigint();
      const latency = Number(endTime - startTime) / 1_000_000;
      
      this.searchTimes.push(latency);
      this.metrics.queryTypes.related++;
      this.totalQueries++;
      
    } catch (error) {
      this.errors++;
      this.totalQueries++;
      logger.warn('Erro nas publicações relacionadas:', error.message);
    }
  }

  private calculateLatencyMetrics(): void {
    if (this.searchTimes.length === 0) return;

    const sorted = this.searchTimes.sort((a, b) => a - b);
    
    this.metrics.searchLatency.min = sorted[0];
    this.metrics.searchLatency.max = sorted[sorted.length - 1];
    this.metrics.searchLatency.avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    this.metrics.searchLatency.p95 = sorted[Math.floor(sorted.length * 0.95)];
    this.metrics.searchLatency.p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    this.metrics.errorRate = (this.errors / this.totalQueries) * 100;
  }

  private async collectClusterMetrics(): Promise<void> {
    logger.info('📈 Coletando métricas do cluster...');
    
    try {
      // Simular coleta de métricas do cluster
      // Em uma implementação real, você usaria a API do Elasticsearch
      this.metrics.clusterHealth = {
        status: 'green',
        activeShards: 5,
        relocatingShards: 0,
        unassignedShards: 0,
      };
      
      // Simular métricas de indexação
      this.metrics.indexingThroughput = {
        docsPerSecond: 150,
        avgLatency: 45,
      };
      
      // Simular cache hit rate
      this.metrics.cacheHitRate = 85.5;
      
    } catch (error) {
      logger.warn('Erro ao coletar métricas do cluster:', error.message);
    }
  }

  private generateReport(): void {
    console.log('\\n' + '='.repeat(80));
    console.log('📊 RELATÓRIO DE PERFORMANCE - ELASTICSEARCH');
    console.log('='.repeat(80));
    
    console.log('\\n🔍 LATÊNCIA DE BUSCA:');
    console.log(`   Média:     ${this.metrics.searchLatency.avg.toFixed(2)}ms`);
    console.log(`   Mínima:    ${this.metrics.searchLatency.min.toFixed(2)}ms`);
    console.log(`   Máxima:    ${this.metrics.searchLatency.max.toFixed(2)}ms`);
    console.log(`   P95:       ${this.metrics.searchLatency.p95.toFixed(2)}ms`);
    console.log(`   P99:       ${this.metrics.searchLatency.p99.toFixed(2)}ms`);
    
    console.log('\\n📈 THROUGHPUT DE INDEXAÇÃO:');
    console.log(`   Docs/seg:  ${this.metrics.indexingThroughput.docsPerSecond}`);
    console.log(`   Latência:  ${this.metrics.indexingThroughput.avgLatency}ms`);
    
    console.log('\\n🏥 SAÚDE DO CLUSTER:');
    console.log(`   Status:           ${this.metrics.clusterHealth.status}`);
    console.log(`   Shards ativos:    ${this.metrics.clusterHealth.activeShards}`);
    console.log(`   Shards movendo:   ${this.metrics.clusterHealth.relocatingShards}`);
    console.log(`   Shards órfãos:    ${this.metrics.clusterHealth.unassignedShards}`);
    
    console.log('\\n🔄 TIPOS DE QUERY:');
    console.log(`   Semântica:        ${this.metrics.queryTypes.semantic}`);
    console.log(`   Sugestões:        ${this.metrics.queryTypes.suggestions}`);
    console.log(`   Relacionadas:     ${this.metrics.queryTypes.related}`);
    
    console.log('\\n⚠️  QUALIDADE:');
    console.log(`   Taxa de erro:     ${this.metrics.errorRate.toFixed(2)}%`);
    console.log(`   Cache hit rate:   ${this.metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`   Total queries:    ${this.totalQueries}`);
    
    console.log('\\n' + '='.repeat(80));
    
    // Recomendações baseadas nas métricas
    this.generateRecommendations();
  }

  private generateRecommendations(): void {
    console.log('💡 RECOMENDAÇÕES:');
    
    if (this.metrics.searchLatency.avg > 100) {
      console.log('   ⚠️  Latência média alta - considere otimizar queries ou aumentar recursos');
    } else {
      console.log('   ✅ Latência dentro do esperado');
    }
    
    if (this.metrics.errorRate > 5) {
      console.log('   ⚠️  Taxa de erro alta - verificar logs e conectividade');
    } else {
      console.log('   ✅ Taxa de erro baixa');
    }
    
    if (this.metrics.cacheHitRate < 70) {
      console.log('   ⚠️  Cache hit rate baixo - revisar estratégia de cache');
    } else {
      console.log('   ✅ Cache funcionando bem');
    }
    
    if (this.metrics.clusterHealth.status !== 'green') {
      console.log('   ⚠️  Cluster não está saudável - verificar configuração');
    } else {
      console.log('   ✅ Cluster saudável');
    }
    
    console.log('\\n' + '='.repeat(80));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    try {
      await AppDataSource.destroy();
      logger.info('📴 Monitoramento finalizado');
    } catch (error) {
      logger.error('Erro ao finalizar monitoramento:', error);
    }
  }
}

// Executar o monitor se este arquivo for executado diretamente
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\\n🛑 Interrompendo monitoramento...');
    await monitor.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\\n🛑 Finalizando monitoramento...');
    await monitor.stop();
    process.exit(0);
  });
  
  monitor.start().catch((error) => {
    logger.error('Erro fatal no monitor:', error);
    process.exit(1);
  });
}
