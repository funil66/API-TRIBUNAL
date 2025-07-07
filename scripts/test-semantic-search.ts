import { AppDataSource } from '../src/config/database.config';
import { redisClient } from '../src/config/redis.config';
import { testElasticsearchConnection, initializeElasticsearchIndices } from '../src/config/elasticsearch.config';
import { ElasticsearchService } from '../src/services/elasticsearch.service';
import { SearchService } from '../src/services/search.service';
import { Publication } from '../src/models/publication.entity';

async function testSemanticSearch() {
  try {
    console.log('🚀 Testing Semantic Search System...\n');

    // Initialize connections
    console.log('1. Initializing connections...');
    await AppDataSource.initialize();
    await redisClient.connect();
    await testElasticsearchConnection();
    await initializeElasticsearchIndices();
    console.log('✅ All connections established\n');

    const elasticsearchService = new ElasticsearchService();
    const searchService = new SearchService();

    // Test 1: Index sample publications
    console.log('2. Indexing sample publications...');
    const samplePublications = [
      {
        id: 'pub-001',
        tribunal: 'TJSP',
        date: new Date('2023-10-15'),
        content: 'Processo nº 1234567-89.2023.8.26.0001. Ação de cobrança movida por João Silva contra Maria Santos. Decisão: procedente o pedido, condenando a ré ao pagamento de R$ 10.000,00.',
        page: 125,
        url: 'https://dje.tjsp.jus.br/detalhe.aspx?id=123',
        processNumber: '1234567-89.2023.8.26.0001',
        parties: ['João Silva', 'Maria Santos'],
        judge: 'Dr. Carlos Pereira',
        category: 'Cobrança',
        summary: 'Ação de cobrança procedente'
      },
      {
        id: 'pub-002',
        tribunal: 'TJSP',
        date: new Date('2023-10-16'),
        content: 'Processo nº 9876543-21.2023.8.26.0002. Ação de divórcio consensual entre Ana Costa e Pedro Oliveira. Decisão: homologado o acordo, decretado o divórcio.',
        page: 67,
        url: 'https://dje.tjsp.jus.br/detalhe.aspx?id=124',
        processNumber: '9876543-21.2023.8.26.0002',
        parties: ['Ana Costa', 'Pedro Oliveira'],
        judge: 'Dra. Fernanda Lima',
        category: 'Família',
        summary: 'Divórcio consensual homologado'
      },
      {
        id: 'pub-003',
        tribunal: 'TJSP',
        date: new Date('2023-10-17'),
        content: 'Processo nº 5555555-55.2023.8.26.0003. Ação trabalhista movida por Carlos Santos contra Empresa XYZ Ltda. Decisão: procedente em parte, deferido pagamento de horas extras.',
        page: 89,
        url: 'https://dje.tjsp.jus.br/detalhe.aspx?id=125',
        processNumber: '5555555-55.2023.8.26.0003',
        parties: ['Carlos Santos', 'Empresa XYZ Ltda'],
        judge: 'Dr. Roberto Silva',
        category: 'Trabalhista',
        summary: 'Horas extras deferidas'
      }
    ] as Publication[];

    await elasticsearchService.bulkIndexPublications(samplePublications);
    console.log('✅ Sample publications indexed\n');

    // Test 2: Semantic search by name
    console.log('3. Testing semantic search by name...');
    const nameSearch = await searchService.semanticSearch('test-user', {
      query: 'João Silva',
      type: 'name',
      size: 5
    });
    console.log(`Found ${nameSearch.total} results for "João Silva"`);
    nameSearch.results.forEach((result, idx) => {
      console.log(`  ${idx + 1}. Process: ${result.processNumber} (Score: ${result.score?.toFixed(2)})`);
    });
    console.log('');

    // Test 3: Semantic search by content
    console.log('4. Testing semantic search by content...');
    const contentSearch = await searchService.semanticSearch('test-user', {
      query: 'cobrança pagamento',
      type: 'content',
      size: 5
    });
    console.log(`Found ${contentSearch.total} results for "cobrança pagamento"`);
    contentSearch.results.forEach((result, idx) => {
      console.log(`  ${idx + 1}. Category: ${result.category} (Score: ${result.score?.toFixed(2)})`);
    });
    console.log('');

    // Test 4: Date range search
    console.log('5. Testing date range search...');
    const dateSearch = await searchService.semanticSearch('test-user', {
      query: 'processo',
      dateRange: {
        from: new Date('2023-10-15'),
        to: new Date('2023-10-16')
      },
      size: 5
    });
    console.log(`Found ${dateSearch.total} results in date range`);
    console.log('');

    // Test 5: Suggestions
    console.log('6. Testing search suggestions...');
    await elasticsearchService.updateSuggestion('João Silva', 'name');
    await elasticsearchService.updateSuggestion('Maria Santos', 'name');
    await elasticsearchService.updateSuggestion('cobrança', 'content');
    
    const suggestions = await searchService.getSuggestions('João', 'name');
    console.log(`Suggestions for "João": ${suggestions.join(', ')}`);
    console.log('');

    // Test 6: Related publications
    console.log('7. Testing related publications...');
    const related = await searchService.getRelatedPublications('pub-001', 3);
    console.log(`Found ${related.length} related publications to pub-001`);
    related.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.processNumber} (Score: ${result.score?.toFixed(2)})`);
    });
    console.log('');

    // Test 7: Aggregations
    console.log('8. Testing aggregations...');
    const aggSearch = await searchService.semanticSearch('test-user', {
      query: '*',
      size: 0 // Only get aggregations
    });
    if (aggSearch.aggregations) {
      console.log('Tribunals:', aggSearch.aggregations.tribunals.map(t => `${t.key} (${t.count})`).join(', '));
      console.log('Categories:', aggSearch.aggregations.categories.map(c => `${c.key} (${c.count})`).join(', '));
    }
    console.log('');

    console.log('🎉 All semantic search tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    console.log('\n🔚 Connections closed');
  }
}

// Test performance
async function testSearchPerformance() {
  console.log('\n⚡ Testing search performance...');
  
  const start = Date.now();
  const searchService = new SearchService();
  
  const results = await searchService.semanticSearch('test-user', {
    query: 'processo ação',
    size: 20
  });
  
  const end = Date.now();
  const duration = end - start;
  
  console.log(`Search completed in ${duration}ms`);
  console.log(`Found ${results.total} results`);
  console.log(`Average score: ${results.results.reduce((sum, r) => sum + (r.score || 0), 0) / results.results.length}`);
}

// Run tests
if (require.main === module) {
  testSemanticSearch()
    .then(() => testSearchPerformance())
    .catch(console.error);
}
