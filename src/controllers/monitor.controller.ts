import { Request, Response } from 'express';
import { logger } from '../config/logger.config';

export interface Monitor {
  id: string;
  userId: string;
  name: string;
  searchType: 'name' | 'cpf' | 'oab';
  searchTerm: string;
  tribunals: string[];
  active: boolean;
  lastCheck?: Date;
  createdAt: Date;
  updatedAt: Date;
  schedule?: {
    frequency: 'hourly' | 'daily' | 'weekly';
    time?: string; // HH:mm format
    timezone?: string;
  };
  notifications: {
    email: boolean;
    webhook: boolean;
    webhookUrl?: string;
  };
}

export interface CreateMonitorRequest {
  name: string;
  searchType: 'name' | 'cpf' | 'oab';
  searchTerm: string;
  tribunals: string[];
  schedule?: {
    frequency: 'hourly' | 'daily' | 'weekly';
    time?: string;
    timezone?: string;
  };
  notifications: {
    email: boolean;
    webhook: boolean;
    webhookUrl?: string;
  };
}

export interface UpdateMonitorRequest extends Partial<CreateMonitorRequest> {
  active?: boolean;
}

/**
 * Controller para gerenciamento de monitores
 */
export class MonitorController {
  /**
   * Lista monitores do usuário
   */
  async getMonitors(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { page = 1, limit = 10, active } = req.query;

      logger.info('Getting user monitors', {
        userId,
        page,
        limit,
        active
      });

      // Mock implementation - seria implementado com repository
      const monitors: Monitor[] = [
        {
          id: '1',
          userId: userId || '1',
          name: 'Monitor João Silva',
          searchType: 'name',
          searchTerm: 'João Silva',
          tribunals: ['tjsp', 'tjrj'],
          active: true,
          lastCheck: new Date(Date.now() - 3600000), // 1 hour ago
          createdAt: new Date(Date.now() - 86400000), // 1 day ago
          updatedAt: new Date(),
          schedule: {
            frequency: 'daily',
            time: '09:00',
            timezone: 'America/Sao_Paulo'
          },
          notifications: {
            email: true,
            webhook: false
          }
        }
      ];

      const response = {
        data: monitors,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: monitors.length,
          totalPages: Math.ceil(monitors.length / Number(limit))
        }
      };

      res.json(response);
    } catch (error) {
      logger.error('Error getting monitors', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get monitors'
      });
    }
  }

  /**
   * Busca monitor por ID
   */
  async getMonitor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      logger.info('Getting monitor by ID', { id, userId });

      // Mock implementation
      const monitor: Monitor = {
        id,
        userId: userId || '1',
        name: 'Monitor João Silva',
        searchType: 'name',
        searchTerm: 'João Silva',
        tribunals: ['tjsp', 'tjrj'],
        active: true,
        lastCheck: new Date(Date.now() - 3600000),
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
        schedule: {
          frequency: 'daily',
          time: '09:00',
          timezone: 'America/Sao_Paulo'
        },
        notifications: {
          email: true,
          webhook: false
        }
      };

      res.json({ data: monitor });
    } catch (error) {
      logger.error('Error getting monitor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        monitorId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get monitor'
      });
    }
  }

  /**
   * Cria novo monitor
   */
  async createMonitor(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const monitorData: CreateMonitorRequest = req.body;

      logger.info('Creating new monitor', {
        userId,
        name: monitorData.name,
        searchType: monitorData.searchType,
        searchTerm: monitorData.searchTerm
      });

      // Validação básica
      if (!monitorData.name || !monitorData.searchType || !monitorData.searchTerm) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Name, searchType and searchTerm are required'
        });
        return;
      }

      if (!monitorData.tribunals || monitorData.tribunals.length === 0) {
        res.status(400).json({
          error: 'Validation error',
          message: 'At least one tribunal must be selected'
        });
        return;
      }

      // Mock implementation - criação do monitor
      const newMonitor: Monitor = {
        id: `monitor_${Date.now()}`,
        userId: userId || '1',
        name: monitorData.name,
        searchType: monitorData.searchType,
        searchTerm: monitorData.searchTerm,
        tribunals: monitorData.tribunals,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        schedule: monitorData.schedule || {
          frequency: 'daily',
          time: '09:00',
          timezone: 'America/Sao_Paulo'
        },
        notifications: monitorData.notifications
      };

      logger.info('Monitor created successfully', {
        monitorId: newMonitor.id,
        userId,
        name: newMonitor.name
      });

      res.status(201).json({ data: newMonitor });
    } catch (error) {
      logger.error('Error creating monitor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create monitor'
      });
    }
  }

  /**
   * Atualiza monitor
   */
  async updateMonitor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const updateData: UpdateMonitorRequest = req.body;

      logger.info('Updating monitor', { id, userId, updateData });

      // Mock implementation - atualização do monitor
      const updatedMonitor: Monitor = {
        id,
        userId: userId || '1',
        name: updateData.name || 'Monitor João Silva',
        searchType: updateData.searchType || 'name',
        searchTerm: updateData.searchTerm || 'João Silva',
        tribunals: updateData.tribunals || ['tjsp'],
        active: updateData.active !== undefined ? updateData.active : true,
        lastCheck: new Date(Date.now() - 3600000),
        createdAt: new Date(Date.now() - 86400000),
        updatedAt: new Date(),
        schedule: updateData.schedule || {
          frequency: 'daily',
          time: '09:00',
          timezone: 'America/Sao_Paulo'
        },
        notifications: updateData.notifications || {
          email: true,
          webhook: false
        }
      };

      logger.info('Monitor updated successfully', {
        monitorId: id,
        userId
      });

      res.json({ data: updatedMonitor });
    } catch (error) {
      logger.error('Error updating monitor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        monitorId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update monitor'
      });
    }
  }

  /**
   * Deleta monitor
   */
  async deleteMonitor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      logger.info('Deleting monitor', { id, userId });

      // Mock implementation - deleção do monitor
      logger.info('Monitor deleted successfully', {
        monitorId: id,
        userId
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting monitor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        monitorId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete monitor'
      });
    }
  }

  /**
   * Executa monitor manualmente
   */
  async runMonitor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      logger.info('Running monitor manually', { id, userId });

      // Mock implementation - execução manual do monitor
      const result = {
        monitorId: id,
        startedAt: new Date(),
        status: 'running',
        message: 'Monitor execution started'
      };

      logger.info('Monitor execution started', {
        monitorId: id,
        userId
      });

      res.json({ data: result });
    } catch (error) {
      logger.error('Error running monitor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        monitorId: req.params.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to run monitor'
      });
    }
  }

  /**
   * Busca estatísticas dos monitores
   */
  async getMonitorStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      logger.info('Getting monitor stats', { userId });

      // Mock implementation
      const stats = {
        total: 5,
        active: 4,
        inactive: 1,
        lastExecutions: 15,
        publicationsFound: 8,
        notificationsSent: 12,
        successRate: 95.5,
        avgExecutionTime: 2.3 // seconds
      };

      res.json({ data: stats });
    } catch (error) {
      logger.error('Error getting monitor stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get monitor stats'
      });
    }
  }
}

export default new MonitorController();
