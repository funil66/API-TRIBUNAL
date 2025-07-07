import puppeteer, { Browser, Page, HTTPRequest } from 'puppeteer';
import { logger } from '../config/logger.config';
import { appConfig } from '../config/app.config';
import { ApiError } from '../utils/api-error';

export interface ScraperConfig {
  headless: boolean;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  userAgent: string;
}

export interface ScrapedPublication {
  tribunal: string;
  date: Date;
  content: string;
  page?: number;
  url: string;
  processNumber?: string;
  parties: string[];
  judge?: string;
  metadata?: Record<string, any>;
}

export abstract class BaseScraper {
  protected browser: Browser | null = null;
  protected config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      headless: appConfig.puppeteer.headless,
      timeout: appConfig.puppeteer.timeout,
      maxRetries: 3,
      retryDelay: 2000,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ...config
    };
  }

  /**
   * Initialize browser instance
   */
  protected async initBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        timeout: this.config.timeout
      });

      logger.info('Browser initialized successfully');
      return this.browser;
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw new ApiError(500, 'Failed to initialize scraper');
    }
  }

  /**
   * Create new page with default settings
   */
  protected async createPage(): Promise<Page> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    // Set user agent
    await page.setUserAgent(this.config.userAgent);

    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });

    // Set default timeout
    page.setDefaultTimeout(this.config.timeout);

    // Block unnecessary resources to improve performance
    await page.setRequestInterception(true);
    page.on('request', (req: HTTPRequest) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return page;
  }

  /**
   * Execute function with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug(`Attempting ${operationName} (attempt ${attempt}/${this.config.maxRetries})`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`${operationName} failed on attempt ${attempt}:`, error);

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    logger.error(`${operationName} failed after ${this.config.maxRetries} attempts`);
    throw new ApiError(500, `Scraping failed: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Wait for specified time
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        logger.info('Browser closed successfully');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }
  }

  /**
   * Abstract method to be implemented by specific scrapers
   */
  abstract searchByName(name: string, dateRange?: { start: Date; end: Date }): Promise<ScrapedPublication[]>;
  abstract searchByCpf(cpf: string, dateRange?: { start: Date; end: Date }): Promise<ScrapedPublication[]>;
  abstract searchByOab(oab: string, dateRange?: { start: Date; end: Date }): Promise<ScrapedPublication[]>;

  /**
   * Get tribunal identifier
   */
  abstract getTribunalId(): string;

  /**
   * Get tribunal name
   */
  abstract getTribunalName(): string;
}
