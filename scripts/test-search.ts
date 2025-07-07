import { SearchService } from '../src/services/search.service';
import { AppDataSource } from '../src/config/database.config';

async function testSearch() {
  try {
    console.log('Initializing database connection...');
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    const searchService = new SearchService();
    
    console.log('Testing search service...');
    
    // Test a simple search
    const result = await searchService.executeSearch('test-user-id', {
      type: 'name',
      term: 'João Silva',
      sources: ['TJSP'],
      filters: {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      }
    });

    console.log('Search result:', result);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed');
    }
  }
}

// Run test
testSearch();
