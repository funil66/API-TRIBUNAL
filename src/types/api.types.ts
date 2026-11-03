import { Request } from 'express';
import { User } from '../models/user.entity';

// Auth Types
export interface AuthenticatedRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user: User;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface RefreshJwtPayload {
  userId: string;
  tokenId: string;
  iat?: number;
  exp?: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'password'>;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  cpf?: string;
  oab?: string;
}

// Search Types
export interface SearchRequest {
  type: 'name' | 'cpf' | 'oab';
  term: string;
  sources: string[];
  filters?: SearchFilters;
}

export interface SearchFilters {
  startDate?: Date;
  endDate?: Date;
  tribunals?: string[];
  categories?: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  date: Date;
  tribunal: string;
  page: number;
  url: string;
  processNumber?: string;
  parties: string[];
  judge?: string;
  category?: string;
  relevanceScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  executionTime: number;
  searchId: string;
  pagination: {
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ApiError {
  success: false;
  message: string;
  errors?: string[];
  statusCode: number;
}

// Database connection health
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  services: {
    database: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
  uptime: number;
  version: string;
}

// Rate limiting
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Monitor Types
export interface MonitorRequest {
  name: string;
  searchType: 'name' | 'cpf' | 'oab';
  searchTerm: string;
  tribunals: string[];
}
