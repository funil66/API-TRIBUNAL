import Redis from 'ioredis';
import { appConfig } from './app.config';

export let redisClient: Redis;

export const initializeRedis = (): void => {
  try {
    redisClient = new Redis({
      host: appConfig.redis.host,
      port: appConfig.redis.port,
      password: appConfig.redis.password || undefined,
      db: appConfig.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connection established');
    });

    redisClient.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis is ready to receive commands');
    });

    redisClient.on('close', () => {
      console.log('⚠️ Redis connection closed');
    });

  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error);
    throw error;
  }
};

export const closeRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit();
      console.log('✅ Redis connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing Redis connection:', error);
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
};
