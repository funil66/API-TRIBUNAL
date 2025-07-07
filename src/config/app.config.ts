import { config } from 'dotenv';
import path from 'path';

// Load environment variables
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
config({ path: path.resolve(process.cwd(), envFile) });

export const appConfig = {
  node_env: process.env.NODE_ENV || 'development',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  api_version: process.env.API_VERSION || 'v1',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'legal_search_user',
    password: process.env.DB_PASSWORD || 'legal_search_password',
    database: process.env.DB_DATABASE || 'legal_search_dev',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    refresh_secret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    expires_in: process.env.JWT_EXPIRES_IN || '15m',
    refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
  },
  
  rate_limit: {
    window_ms: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max_requests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file_enabled: process.env.LOG_FILE_ENABLED === 'true',
    max_size: process.env.LOG_MAX_SIZE || '20m',
    max_files: process.env.LOG_MAX_FILES || '14d',
  },
  
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
  },
  
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT || '30000', 10),
  },
} as const;

export default appConfig;
