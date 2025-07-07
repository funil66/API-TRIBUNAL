import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { AppDataSource } from './config/database.config';
import { redisClient } from './config/redis.config';
import { logger } from './config/logger.config';
import { appConfig } from './config/app.config';
import { errorHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/request-logger.middleware';
import authRoutes from './routes/auth.routes';
import searchRoutes from './routes/search.routes';
import monitorRoutes from './routes/monitor.routes';
import { ApiError } from './utils/api-error';
import { testElasticsearchConnection, initializeElasticsearchIndices } from './config/elasticsearch.config';

class App {
  public app: express.Application;

  constructor() {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: appConfig.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use(limiter);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression middleware
    this.app.use(compression());

    // Request logging
    this.app.use(requestLogger);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: appConfig.env
      });
    });
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/search', searchRoutes);
    this.app.use('/api/monitor', monitorRoutes);

    // 404 handler
    this.app.use('*', (req, res, next) => {
      next(new ApiError(404, 'Route not found'));
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Initialize database connection
      await AppDataSource.initialize();
      logger.info('Database connection established');

      // Initialize Redis connection
      await redisClient.connect();
      logger.info('Redis connection established');

      // Test Elasticsearch connection
      await testElasticsearchConnection();
      logger.info('Elasticsearch connection tested');

      // Initialize Elasticsearch indices
      await initializeElasticsearchIndices();
      logger.info('Elasticsearch indices initialized');

      // Start server
      this.app.listen(appConfig.port, () => {
        logger.info(`Server is running on port ${appConfig.port} in ${appConfig.env} mode`);
      });
    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
        logger.info('Database connection closed');
      }

      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

export default App;

// Export Express app instance for testing
export const app = new App().app;

// Start the application if this file is run directly
if (require.main === module) {
  const app = new App();
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await app.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await app.stop();
    process.exit(0);
  });

  app.start();
}