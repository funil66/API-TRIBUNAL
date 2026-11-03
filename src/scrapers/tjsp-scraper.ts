import { BaseScraper, ScrapedPublication } from './base-scraper';
import { logger } from '../config/logger.config';
import { ApiError } from '../utils/api-error';

export class TjspScraper extends BaseScraper {
  private readonly baseUrl = 'https://dje.tjsp.jus.br/cdje/';
  private readonly searchUrl = 'https://dje.tjsp.jus.br/cdje/consultaSimples.do';

  public getTribunalId(): string {
    return 'TJSP';
  }

  public getTribunalName(): string {
    return 'Tribunal de Justiça de São Paulo';
  }

  /**
   * Search publications by name
   */
  public async searchByName(
    name: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<ScrapedPublication[]> {
    return this.withRetry(async () => {
      const page = await this.createPage();
      
      try {
        logger.info(`Searching TJSP for name: ${name}`);
        
        // Navigate to search page
        await page.goto(this.searchUrl, { waitUntil: 'networkidle2' });
        
        // Fill search form
        await this.fillSearchForm(page, {
          searchType: 'name',
          searchTerm: name,
          dateRange
        });
        
        // Submit search
        await this.submitSearch(page);
        
        // Extract results
        const publications = await this.extractPublications(page);
        
        logger.info(`Found ${publications.length} publications for name: ${name}`);
        return publications;
        
      } finally {
        await page.close();
      }
    }, `TJSP name search for: ${name}`);
  }

  /**
   * Search publications by CPF
   */
  public async searchByCpf(
    cpf: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<ScrapedPublication[]> {
    return this.withRetry(async () => {
      const page = await this.createPage();
      
      try {
        logger.info(`Searching TJSP for CPF: ${cpf.replace(/\d{3}(?=\d)/g, 'XXX')}`);
        
        await page.goto(this.searchUrl, { waitUntil: 'networkidle2' });
        
        await this.fillSearchForm(page, {
          searchType: 'cpf',
          searchTerm: cpf,
          dateRange
        });
        
        await this.submitSearch(page);
        const publications = await this.extractPublications(page);
        
        logger.info(`Found ${publications.length} publications for CPF`);
        return publications;
        
      } finally {
        await page.close();
      }
    }, `TJSP CPF search`);
  }

  /**
   * Search publications by OAB number
   */
  public async searchByOab(
    oab: string, 
    dateRange?: { start: Date; end: Date }
  ): Promise<ScrapedPublication[]> {
    return this.withRetry(async () => {
      const page = await this.createPage();
      
      try {
        logger.info(`Searching TJSP for OAB: ${oab}`);
        
        await page.goto(this.searchUrl, { waitUntil: 'networkidle2' });
        
        await this.fillSearchForm(page, {
          searchType: 'oab',
          searchTerm: oab,
          dateRange
        });
        
        await this.submitSearch(page);
        const publications = await this.extractPublications(page);
        
        logger.info(`Found ${publications.length} publications for OAB: ${oab}`);
        return publications;
        
      } finally {
        await page.close();
      }
    }, `TJSP OAB search for: ${oab}`);
  }

  /**
   * Fill search form with parameters
   */
  private async fillSearchForm(
    page: any, 
    params: {
      searchType: 'name' | 'cpf' | 'oab';
      searchTerm: string;
      dateRange?: { start: Date; end: Date };
    }
  ): Promise<void> {
    try {
      // Wait for form to load
      await page.waitForSelector('#pesquisaLivre', { timeout: 10000 });
      
      // Clear and fill search input
      await page.evaluate(() => {
        const input = (document as any).querySelector('#pesquisaLivre');
        if (input) input.value = '';
      });
      
      await page.type('#pesquisaLivre', params.searchTerm);
      
      // Set date range if provided
      if (params.dateRange) {
        await this.setDateRange(page, params.dateRange);
      }
      
      // Select search type if needed
      await this.selectSearchType(page, params.searchType);
      
    } catch (error) {
      logger.error('Error filling search form:', error);
      throw new ApiError(500, 'Failed to fill search form');
    }
  }

  /**
   * Set date range for search
   */
  private async setDateRange(
    page: any, 
    dateRange: { start: Date; end: Date }
  ): Promise<void> {
    try {
      const startDateStr = this.formatDateForInput(dateRange.start);
      const endDateStr = this.formatDateForInput(dateRange.end);
      
      // Check if date inputs exist
      const startDateInput = await page.$('#dtInicio');
      const endDateInput = await page.$('#dtFim');
      
      if (startDateInput && endDateInput) {
        await page.evaluate((start: string, end: string) => {
          const startInput = (document as any).querySelector('#dtInicio');
          const endInput = (document as any).querySelector('#dtFim');
          if (startInput) startInput.value = start;
          if (endInput) endInput.value = end;
        }, startDateStr, endDateStr);
      }
    } catch (error) {
      logger.warn('Could not set date range, continuing without it:', error);
    }
  }

  /**
   * Select search type if available
   */
  private async selectSearchType(
    page: any, 
    searchType: 'name' | 'cpf' | 'oab'
  ): Promise<void> {
    try {
      // Try to find and select appropriate search type
      const typeSelector = await page.$('#tipoConsulta');
      if (typeSelector) {
        const value = searchType === 'name' ? 'nome' : 
                     searchType === 'cpf' ? 'cpf' : 'oab';
        await page.select('#tipoConsulta', value);
      }
    } catch (error) {
      logger.warn('Could not select search type, using default:', error);
    }
  }

  /**
   * Submit search form
   */
  private async submitSearch(page: any): Promise<void> {
    try {
      // Click search button
      await page.click('#botaoPesquisar, .botao-pesquisar, input[type="submit"]');
      
      // Wait for results to load
      await page.waitForFunction(
        () => {
          const loading = (document as any).querySelector('.loading, .carregando');
          return !loading || (window as any).getComputedStyle(loading).display === 'none';
        },
        { timeout: 30000 }
      );
      
      // Additional wait for content
      await this.delay(2000);
      
    } catch (error) {
      logger.error('Error submitting search:', error);
      throw new ApiError(500, 'Failed to submit search');
    }
  }

  /**
   * Extract publications from results page
   */
  private async extractPublications(page: any): Promise<ScrapedPublication[]> {
    try {
      // Wait for results container
      await page.waitForSelector('.resultado, .resultados, .publicacao', { timeout: 10000 });
      
      const publications = await page.evaluate(() => {
        const results: any[] = [];
        
        // Find publication elements
        const publicationElements = (document as any).querySelectorAll('.publicacao, .resultado-item, .dje-publicacao');
        
        publicationElements.forEach((element: any, index: number) => {
          try {
            const content = element.textContent?.trim() || '';
            if (content.length < 10) return;
            
            // Extract date
            const dateText = element.querySelector('.data, .data-publicacao')?.textContent || '';
            let publicationDate = new Date();
            
            if (dateText) {
              const dateMatch = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (dateMatch) {
                publicationDate = new Date(
                  parseInt(dateMatch[3]), 
                  parseInt(dateMatch[2]) - 1, 
                  parseInt(dateMatch[1])
                );
              }
            }
            
            // Extract parties
            const parties: string[] = [];
            const nameMatches = content.match(/([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g);
            if (nameMatches) {
              parties.push(...nameMatches.slice(0, 5));
            }
            
            // Extract process number
            let processNumber = '';
            const processMatch = content.match(/\d{7}-?\d{2}\.?\d{4}\.?\d{1}\.?\d{2}\.?\d{4}/);
            if (processMatch) {
              processNumber = processMatch[0];
            }
            
            // Extract page number
            let page = 0;
            const pageMatch = content.match(/página?\s*(\d+)/i);
            if (pageMatch) {
              page = parseInt(pageMatch[1]);
            }
            
            results.push({
              tribunal: 'TJSP',
              date: publicationDate.toISOString(),
              content: content.substring(0, 5000),
              page,
              url: (window as any).location.href,
              processNumber,
              parties: parties.filter((p: string) => p.length > 5),
              metadata: {
                extractedAt: new Date().toISOString(),
                elementIndex: index
              }
            });
          } catch (err) {
            // Ignore individual extraction errors
          }
        });
        
        return results;
      });
      
      return publications.map((pub: any) => ({
        ...pub,
        date: new Date(pub.date)
      }));
      
    } catch (error) {
      logger.warn('No publications found or error extracting:', error);
      return [];
    }
  }

  /**
   * Format date for input fields
   */
  private formatDateForInput(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}
