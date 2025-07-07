import 'reflect-metadata';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Setup global test configurations
});

afterAll(async () => {
  // Cleanup after all tests
});
