import { Request, Response, NextFunction } from 'express';
import { SearchService, SearchRequest as ServiceSearchRequest } from '../services/search.service';
import { ApiError } from '../utils/api-error';
import { logger } from '../config/logger.config';
import { isValidCPF } from '../utils/cpf.validator';
import { validateOAB } from '../utils/oab.validator';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class SearchController {
  private searchService = new SearchService();

  /**
   * Execute a new search
   * POST /api/search
   */
  public createSearch = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { type, term, sources, filters } = (req as any).body;
      const userId = req.user.id;

      // Validate search term based on type
      if (!term || term.trim().length === 0) {
        return next(new ApiError(400, 'Search term is required'));
      }

      if (type === 'cpf' && !isValidCPF(term)) {
        return next(new ApiError(400, 'Invalid CPF format'));
      }

      if (type === 'oab' && !validateOAB(term)) {
        return next(new ApiError(400, 'Invalid OAB format'));
      }

      if (!sources || sources.length === 0) {
        return next(new ApiError(400, 'At least one source must be specified'));
      }

      // Execute search
      const result = await this.searchService.executeSearch(userId, {
        type,
        term: term.trim(),
        sources,
        filters
      });

      const response = {
        success: true,
        data: result,
        message: 'Search initiated successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Error creating search:', error);
      next(error);
    }
  };

  /**
   * Get search history for authenticated user
   * GET /api/search/history
   */
  public getSearchHistory = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const page = parseInt((req as any).query.page as string) || 1;
      const limit = parseInt((req as any).query.limit as string) || 10;
      const status = (req as any).query.status as string;

      const history = await this.searchService.getSearchHistory(userId, {
        page,
        limit,
        status: status as any
      });

      const response = {
        success: true,
        data: history,
        message: 'Search history retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting search history:', error);
      next(error);
    }
  };

  /**
   * Get search details by ID
   * GET /api/search/:id
   */
  public getSearchById = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = (req as any).params;
      const userId = req.user.id;

      if (!id) {
        return next(new ApiError(400, 'Search ID is required'));
      }

      const search = await this.searchService.getSearchById(id, userId);

      if (!search) {
        return next(new ApiError(404, 'Search not found'));
      }

      const response = {
        success: true,
        data: search,
        message: 'Search retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting search:', error);
      next(error);
    }
  };

  /**
   * Cancel a pending/running search
   * DELETE /api/search/:id
   */
  public cancelSearch = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = (req as any).params;
      const userId = req.user.id;

      if (!id) {
        return next(new ApiError(400, 'Search ID is required'));
      }

      await this.searchService.cancelSearch(id, userId);

      const response = {
        success: true,
        message: 'Search cancelled successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error cancelling search:', error);
      next(error);
    }
  };

  /**
   * Get search statistics for user
   * GET /api/search/stats
   */
  public getSearchStats = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const stats = await this.searchService.getSearchStats(userId);

      const response = {
        success: true,
        data: stats,
        message: 'Search statistics retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting search stats:', error);
      next(error);
    }
  };

  /**
   * Perform semantic search
   * GET /api/search/semantic
   */
  public semanticSearch = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user.id;
      const { q, type, tribunals, dateFrom, dateTo, size, from } = (req as any).query;

      if (!q || q.trim().length === 0) {
        return next(new ApiError(400, 'Query parameter "q" is required'));
      }

      const searchRequest = {
        query: q.trim(),
        type: type || 'content',
        tribunals: tribunals ? tribunals.split(',') : undefined,
        dateRange: dateFrom || dateTo ? {
          from: dateFrom ? new Date(dateFrom) : undefined,
          to: dateTo ? new Date(dateTo) : undefined
        } : undefined,
        size: size ? parseInt(size) : 20,
        from: from ? parseInt(from) : 0
      };

      const result = await this.searchService.semanticSearch(userId, searchRequest);

      const response = {
        success: true,
        data: result,
        message: 'Semantic search completed successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error in semantic search:', error);
      next(error);
    }
  };

  /**
   * Get search suggestions
   * GET /api/search/suggestions
   */
  public getSuggestions = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { q, type } = (req as any).query;

      if (!q || q.trim().length < 2) {
        return next(new ApiError(400, 'Query parameter "q" must be at least 2 characters'));
      }

      const suggestions = await this.searchService.getSuggestions(q.trim(), type);

      const response = {
        success: true,
        data: { suggestions },
        message: 'Suggestions retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      next(error);
    }
  };

  /**
   * Get related publications
   * GET /api/search/related/:id
   */
  public getRelatedPublications = async (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = (req as any).params;
      const size = parseInt((req as any).query.size) || 5;

      if (!id) {
        return next(new ApiError(400, 'Publication ID is required'));
      }

      const related = await this.searchService.getRelatedPublications(id, size);

      const response = {
        success: true,
        data: { related },
        message: 'Related publications retrieved successfully'
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting related publications:', error);
      next(error);
    }
  };
}
