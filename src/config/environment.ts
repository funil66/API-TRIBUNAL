import { config } from 'dotenv';

config();

const environment = {
  PORT: process.env.PORT || 3000,
  DB_URI: process.env.DB_URI || 'mongodb://localhost:27017/legal-search',
  JWT_SECRET: process.env.JWT_SECRET || 'your_jwt_secret',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DJE_API_URL: process.env.DJE_API_URL || 'https://example.com/dje',
  DJEN_API_URL: process.env.DJEN_API_URL || 'https://example.com/djen',
  PAYMENT_GATEWAY_URL: process.env.PAYMENT_GATEWAY_URL || 'https://example.com/payment',
};

export default environment;