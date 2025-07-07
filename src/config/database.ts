import { Sequelize } from 'sequelize';
import { config } from './environment';

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: 'postgres', // or 'mysql', 'sqlite', etc.
  logging: false, // Set to true for SQL query logging
});

export default sequelize;