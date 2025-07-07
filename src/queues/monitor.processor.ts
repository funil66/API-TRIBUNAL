import { logger } from '../config/logger.config';

export interface MonitorJobData {
  monitorId: string;
  userId: string;
  searchType: 'name' | 'cpf' | 'oab';
  searchTerm: string;
  tribunals: string[];
  lastCheck: Date;
}

export interface PublicationMatch {
  id: string;
  tribunal: string;
  date: Date;
  content: string;
  url: string;
  relevanceScore: number;
}

/**
 * Processador de jobs de monitoramento
 */
export class MonitorProcessor {
  /**
   * Processa job de monitoramento
   */
  async processMonitorJob(jobData: MonitorJobData): Promise<void> {
    const { monitorId, userId, searchType, searchTerm, tribunals, lastCheck } = jobData;
    
    try {
      logger.info('Processing monitor job', {
        monitorId,
        userId,
        searchType,
        searchTerm,
        tribunals: tribunals.length
      });

      const newPublications: PublicationMatch[] = [];

      // Buscar novas publicações em cada tribunal
      for (const tribunal of tribunals) {
        const publications = await this.searchTribunal(tribunal, searchType, searchTerm, lastCheck);
        newPublications.push(...publications);
      }

      logger.info('Monitor job found publications', {
        monitorId,
        publicationsFound: newPublications.length
      });

      // Se encontrou publicações, disparar notificações
      if (newPublications.length > 0) {
        await this.triggerNotifications(userId, monitorId, newPublications);
      }

      // Atualizar último check do monitor
      await this.updateMonitorLastCheck(monitorId);

    } catch (error) {
      logger.error('Error processing monitor job', {
        monitorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Busca publicações em um tribunal específico
   */
  private async searchTribunal(
    tribunal: string,
    searchType: string,
    searchTerm: string,
    lastCheck: Date
  ): Promise<PublicationMatch[]> {
    try {
      logger.debug('Searching tribunal', { tribunal, searchType, searchTerm });

      // Mock implementation - seria implementado com scraper real
      const mockPublications: PublicationMatch[] = [];

      // Simular busca no tribunal
      if (Math.random() > 0.7) { // 30% chance de encontrar algo
        mockPublications.push({
          id: `pub_${Date.now()}_${Math.random()}`,
          tribunal,
          date: new Date(),
          content: `Publicação encontrada para ${searchTerm} no ${tribunal}`,
          url: `https://${tribunal}.jus.br/dje/publication/123456`,
          relevanceScore: Math.random() * 100
        });
      }

      return mockPublications;
    } catch (error) {
      logger.error('Error searching tribunal', {
        tribunal,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Dispara notificações para as publicações encontradas
   */
  private async triggerNotifications(
    userId: string,
    monitorId: string,
    publications: PublicationMatch[]
  ): Promise<void> {
    try {
      logger.info('Triggering notifications', {
        userId,
        monitorId,
        publicationsCount: publications.length
      });

      // Mock implementation - seria implementado com NotificationService
      for (const publication of publications) {
        // Criar notificação de email
        const emailData = {
          to: `user_${userId}@example.com`, // seria buscado do banco
          subject: `Nova publicação encontrada - ${publication.tribunal}`,
          template: 'new_publication',
          data: {
            publication,
            monitorId,
            userName: 'Usuário'
          }
        };

        logger.info('Email notification created', {
          userId,
          publicationId: publication.id,
          tribunal: publication.tribunal
        });
      }

    } catch (error) {
      logger.error('Error triggering notifications', {
        userId,
        monitorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Atualiza último check do monitor
   */
  private async updateMonitorLastCheck(monitorId: string): Promise<void> {
    try {
      // Mock implementation - seria implementado com repository
      logger.debug('Updated monitor last check', { monitorId, timestamp: new Date() });
    } catch (error) {
      logger.error('Error updating monitor last check', {
        monitorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Handler para job falhou
   */
  async onMonitorJobFailed(jobData: MonitorJobData, error: Error): Promise<void> {
    logger.error('Monitor job failed', {
      error: error.message,
      monitorId: jobData.monitorId,
      searchTerm: jobData.searchTerm
    });
  }

  /**
   * Handler para job completado
   */
  async onMonitorJobCompleted(jobData: MonitorJobData, result: any): Promise<void> {
    logger.info('Monitor job completed', {
      monitorId: jobData.monitorId,
      searchTerm: jobData.searchTerm,
      result
    });
  }
}

export default new MonitorProcessor();
