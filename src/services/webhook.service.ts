import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import crypto from 'crypto';
import { logger } from '../config/logger.config';

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: Date;
  id: string;
  user_id: string;
}

export interface WebhookConfig {
  url: string;
  headers?: Record<string, string>;
  secret?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface WebhookResponse {
  success: boolean;
  status: number;
  response?: any;
  error?: string;
  duration: number;
  attempt: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  lastAttempt: Date;
  lastError?: string;
  totalDuration: number;
  responses: WebhookResponse[];
}

export class WebhookService {
  /**
   * Envia webhook com retry automático
   */
  async sendWebhook(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const maxRetries = config.retries || 3;
    const retryDelay = config.retryDelay || 1000;
    const responses: WebhookResponse[] = [];
    
    let lastError: string | undefined;
    let success = false;

    for (let attempt = 1; attempt <= maxRetries && !success; attempt++) {
      try {
        const response = await this.executeWebhook(config, payload, attempt);
        responses.push(response);

        if (response.success) {
          success = true;
          logger.info('Webhook delivered successfully', {
            url: config.url,
            attempt,
            status: response.status,
            duration: response.duration
          });
        } else {
          lastError = response.error || `HTTP ${response.status}`;
          
          if (attempt < maxRetries) {
            await this.delay(retryDelay * Math.pow(2, attempt - 1)); // Exponential backoff
          }
        }
      } catch (error) {
        const errorResponse: WebhookResponse = {
          success: false,
          status: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          attempt
        };
        
        responses.push(errorResponse);
        lastError = errorResponse.error;
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    const totalDuration = Date.now() - startTime;

    const result: WebhookDeliveryResult = {
      success,
      attempts: responses.length,
      lastAttempt: new Date(),
      lastError: success ? undefined : lastError,
      totalDuration,
      responses
    };

    // Log do resultado final
    if (!success) {
      logger.error('Webhook delivery failed after all retries', {
        url: config.url,
        attempts: responses.length,
        lastError,
        totalDuration
      });
    }

    return result;
  }

  /**
   * Valida URL contra SSRF (Server-Side Request Forgery)
   */
  public validateUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      // Bloquear loopback, link-local e metadados de cloud
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.startsWith('127.') ||
        host === '169.254.169.254' || // AWS/GCP Metadata
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
        host.endsWith('.internal') ||
        host.endsWith('.local')
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Executa uma tentativa de webhook
   */
  private async executeWebhook(
    config: WebhookConfig,
    payload: WebhookPayload,
    attempt: number
  ): Promise<WebhookResponse> {
    const startTime = Date.now();
    
    if (!this.validateUrl(config.url)) {
      return {
        success: false,
        status: 400,
        error: 'URL de webhook inválida ou apontando para rede privada/restrita (SSRF Protection)',
        duration: 0,
        attempt
      };
    }
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Legal-Search-API/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp.toISOString(),
        'X-Webhook-Attempt': attempt.toString(),
        ...config.headers
      };

      // Adicionar assinatura se secret estiver presente
      if (config.secret) {
        const signature = this.generateSignature(JSON.stringify(payload), config.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const requestConfig: AxiosRequestConfig = {
        method: 'POST',
        url: config.url,
        headers,
        data: payload,
        timeout: config.timeout || 10000,
        validateStatus: (status: number) => status >= 200 && status < 300
      };

      const response: AxiosResponse = await axios(requestConfig);
      const duration = Date.now() - startTime;

      return {
        success: true,
        status: response.status,
        response: response.data,
        duration,
        attempt
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      if (axios.isAxiosError(error)) {
        return {
          success: false,
          status: error.response?.status || 0,
          error: error.message,
          response: error.response?.data,
          duration,
          attempt
        };
      }

      return {
        success: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        attempt
      };
    }
  }

  /**
   * Gera assinatura HMAC-SHA256 para o payload
   */
  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Valida assinatura do webhook de forma timing-safe
   */
  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Busca estatísticas de webhooks
   */
  async getWebhookStats(userId?: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    deliveryRate: number;
    averageResponseTime: number;
  }> {
    // Mock implementation - seria implementado com acesso ao banco
    return {
      total: 0,
      delivered: 0,
      failed: 0,
      pending: 0,
      deliveryRate: 0,
      averageResponseTime: 0
    };
  }

  /**
   * Testa webhook com payload de exemplo
   */
  async testWebhook(config: WebhookConfig, userId: string): Promise<WebhookResponse> {
    const testPayload: WebhookPayload = {
      event: 'webhook_test',
      data: {
        message: 'This is a test webhook from Legal Search API',
        timestamp: new Date(),
        user_id: userId
      },
      timestamp: new Date(),
      id: `test_${Date.now()}`,
      user_id: userId
    };

    const response = await this.executeWebhook(config, testPayload, 1);
    
    logger.info('Webhook test executed', {
      url: config.url,
      success: response.success,
      status: response.status,
      duration: response.duration
    });

    return response;
  }

  /**
   * Utility para delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (Date.now() - start >= ms) {
          resolve();
        } else {
          setImmediate(check);
        }
      };
      check();
    });
  }
}

export default new WebhookService();
