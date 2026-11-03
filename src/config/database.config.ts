import { DataSource } from 'typeorm';
import { appConfig } from './app.config';
import { User } from '@/models/user.entity';
import { Search } from '@/models/search.entity';
import { Publication } from '@/models/publication.entity';
import { Monitor } from '@/models/monitor.entity';
import { RefreshToken } from '@/models/refresh-token.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: appConfig.database.host,
  port: appConfig.database.port,
  username: appConfig.database.username,
  password: appConfig.database.password,
  database: appConfig.database.database,
  synchronize: appConfig.database.synchronize,
  logging: appConfig.database.logging,
  entities: [User, Search, Publication, Monitor, RefreshToken],
  migrations: ['dist/migrations/*.js'],
  subscribers: ['dist/subscribers/*.js'],
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('✅ Database connection has been initialized successfully.');
  } catch (error) {
    console.error('❌ Error during database initialization:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.destroy();
    console.log('✅ Database connection has been closed.');
  } catch (error) {
    console.error('❌ Error during database closing:', error);
    throw error;
  }
};
