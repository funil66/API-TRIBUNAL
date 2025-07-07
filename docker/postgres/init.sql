-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database if not exists (handled by Docker environment)
-- The database legal_search_dev will be created automatically by Docker

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE legal_search_dev TO legal_search_user;

-- Create additional extensions that might be needed
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Set timezone
SET timezone = 'UTC';
