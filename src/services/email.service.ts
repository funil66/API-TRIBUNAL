import nodemailer from 'nodemailer';
import { appConfig } from '../config/app.config';
import { logger } from '../config/logger.config';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EmailConfig {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

export interface EmailResult {
  messageId: string;
  response?: string;
  accepted?: string[];
  rejected?: string[];
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private templatesCache: Map<string, string> = new Map();

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter
   */
  private initializeTransporter(): void {
    try {
      // Configure based on environment
      if (appConfig.email.provider === 'smtp') {
        this.transporter = nodemailer.createTransporter({
          host: appConfig.email.smtp.host,
          port: appConfig.email.smtp.port,
          secure: appConfig.email.smtp.secure,
          auth: {
            user: appConfig.email.smtp.user,
            pass: appConfig.email.smtp.password,
          },
          tls: {
            rejectUnauthorized: appConfig.email.smtp.rejectUnauthorized !== false,
          },
        });
      } else if (appConfig.email.provider === 'sendgrid') {
        // SendGrid configuration
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: appConfig.email.sendgrid.apiKey,
          },
        });
      } else {
        // Development/testing configuration
        this.transporter = nodemailer.createTransporter({
          host: 'localhost',
          port: 1025, // MailHog default port
          ignoreTLS: true,
        });
      }

      logger.info(`✅ Email service initialized with provider: ${appConfig.email.provider}`);

    } catch (error) {
      logger.error('❌ Failed to initialize email service:', error);
      throw error;
    }
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(config: EmailConfig): Promise<EmailResult> {
    try {
      const { to, subject, template, data, from, replyTo, attachments } = config;

      logger.debug('Sending notification email:', { to, subject, template });

      // Render email template
      const htmlContent = await this.renderTemplate(template, data);
      const textContent = this.htmlToText(htmlContent);

      // Prepare email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: from || appConfig.email.defaults.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        replyTo: replyTo || appConfig.email.defaults.replyTo,
        subject,
        html: htmlContent,
        text: textContent,
        attachments,
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      logger.info(`📧 Email sent successfully: ${result.messageId}`);

      return {
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted,
        rejected: result.rejected,
      };

    } catch (error) {
      logger.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail: string, userData: any): Promise<EmailResult> {
    return this.sendNotificationEmail({
      to: userEmail,
      subject: 'Bem-vindo ao Legal Search API!',
      template: 'welcome',
      data: {
        userName: userData.name,
        loginUrl: `${appConfig.app.baseUrl}/login`,
        supportEmail: appConfig.email.defaults.support,
        ...userData,
      },
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail: string, resetToken: string, userData: any): Promise<EmailResult> {
    const resetUrl = `${appConfig.app.baseUrl}/reset-password?token=${resetToken}`;

    return this.sendNotificationEmail({
      to: userEmail,
      subject: 'Redefinição de senha - Legal Search API',
      template: 'password_reset',
      data: {
        userName: userData.name,
        resetUrl,
        expiresIn: '24 horas',
        supportEmail: appConfig.email.defaults.support,
        ...userData,
      },
    });
  }

  /**
   * Send monitor error notification
   */
  async sendMonitorErrorEmail(
    userEmail: string,
    monitorData: any,
    errorDetails: any
  ): Promise<EmailResult> {
    return this.sendNotificationEmail({
      to: userEmail,
      subject: `Erro no Monitor: ${monitorData.name}`,
      template: 'monitor_error',
      data: {
        monitorName: monitorData.name,
        searchTerm: monitorData.searchTerm,
        searchType: monitorData.searchType,
        errorMessage: errorDetails.message,
        timestamp: new Date().toLocaleString('pt-BR'),
        dashboardUrl: `${appConfig.app.baseUrl}/monitors`,
        supportEmail: appConfig.email.defaults.support,
        ...monitorData,
        ...errorDetails,
      },
    });
  }

  /**
   * Send new publications notification
   */
  async sendNewPublicationsEmail(
    userEmail: string,
    monitorData: any,
    publications: any[]
  ): Promise<EmailResult> {
    const count = publications.length;
    const subject = count === 1 
      ? `1 nova publicação encontrada`
      : `${count} novas publicações encontradas`;

    return this.sendNotificationEmail({
      to: userEmail,
      subject: `${subject} - ${monitorData.name}`,
      template: 'new_publications',
      data: {
        monitorName: monitorData.name,
        searchTerm: monitorData.searchTerm,
        searchType: monitorData.searchType,
        publicationsCount: count,
        publications: publications.slice(0, 10), // Limit to first 10
        hasMore: count > 10,
        moreCount: Math.max(0, count - 10),
        dashboardUrl: `${appConfig.app.baseUrl}/monitors/${monitorData.id}`,
        unsubscribeUrl: `${appConfig.app.baseUrl}/monitors/${monitorData.id}/unsubscribe`,
        ...monitorData,
      },
    });
  }

  /**
   * Send system alert email
   */
  async sendSystemAlertEmail(
    adminEmails: string[],
    alertType: string,
    alertData: any
  ): Promise<EmailResult> {
    return this.sendNotificationEmail({
      to: adminEmails,
      subject: `Sistema: ${alertType}`,
      template: 'system_alert',
      data: {
        alertType,
        timestamp: new Date().toLocaleString('pt-BR'),
        ...alertData,
      },
    });
  }

  /**
   * Verify transporter connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('✅ Email service connection verified');
      return true;
    } catch (error) {
      logger.error('❌ Email service connection failed:', error);
      return false;
    }
  }

  /**
   * Render email template
   */
  private async renderTemplate(templateName: string, data: Record<string, any>): Promise<string> {
    try {
      // Check cache first
      let template = this.templatesCache.get(templateName);

      if (!template) {
        // Load template from file
        const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.html`);
        
        try {
          template = await fs.readFile(templatePath, 'utf-8');
          this.templatesCache.set(templateName, template);
        } catch (error) {
          // Fallback to default template
          logger.warn(`Template ${templateName} not found, using default`);
          template = await this.getDefaultTemplate();
        }
      }

      // Simple template rendering (replace {{variable}} with values)
      let rendered = template;
      
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(regex, String(value || ''));
      }

      // Add default values
      rendered = rendered.replace(/{{baseUrl}}/g, appConfig.app.baseUrl);
      rendered = rendered.replace(/{{supportEmail}}/g, appConfig.email.defaults.support);
      rendered = rendered.replace(/{{currentYear}}/g, new Date().getFullYear().toString());

      return rendered;

    } catch (error) {
      logger.error('Error rendering email template:', error);
      throw error;
    }
  }

  /**
   * Get default email template
   */
  private async getDefaultTemplate(): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal Search API</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .alert { background: #f39c12; color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .success { background: #27ae60; color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Legal Search API</h1>
    </div>
    <div class="content">
        <h2>{{title}}</h2>
        <p>{{message}}</p>
        {{#actionUrl}}
        <p><a href="{{actionUrl}}" class="button">Ver Detalhes</a></p>
        {{/actionUrl}}
    </div>
    <div class="footer">
        <p>&copy; {{currentYear}} Legal Search API. Todos os direitos reservados.</p>
        <p>Dúvidas? Entre em contato: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
    </div>
</body>
</html>`;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Create email templates directory if it doesn't exist
   */
  async ensureTemplateDirectory(): Promise<void> {
    try {
      const templatesDir = path.join(__dirname, '..', 'templates', 'email');
      await fs.mkdir(templatesDir, { recursive: true });
      
      // Create default templates if they don't exist
      await this.createDefaultTemplates(templatesDir);
      
      logger.info('✅ Email templates directory ensured');
    } catch (error) {
      logger.error('Error ensuring template directory:', error);
    }
  }

  /**
   * Create default email templates
   */
  private async createDefaultTemplates(templatesDir: string): Promise<void> {
    const templates = {
      'welcome.html': this.getWelcomeTemplate(),
      'password_reset.html': this.getPasswordResetTemplate(),
      'new_publications.html': this.getNewPublicationsTemplate(),
      'monitor_error.html': this.getMonitorErrorTemplate(),
      'system_alert.html': this.getSystemAlertTemplate(),
    };

    for (const [filename, content] of Object.entries(templates)) {
      const filePath = path.join(templatesDir, filename);
      
      try {
        await fs.access(filePath);
        // File exists, skip
      } catch (error) {
        // File doesn't exist, create it
        await fs.writeFile(filePath, content, 'utf-8');
        logger.debug(`Created email template: ${filename}`);
      }
    }
  }

  // Template content methods
  private getWelcomeTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Bem-vindo ao Legal Search API</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 30px; }
        .button { display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Bem-vindo ao Legal Search API!</h1>
    </div>
    <div class="content">
        <h2>Olá, {{userName}}!</h2>
        <p>Seja bem-vindo ao Legal Search API! Sua conta foi criada com sucesso.</p>
        <p>Agora você pode:</p>
        <ul>
            <li>Realizar buscas em publicações jurídicas</li>
            <li>Configurar monitores automáticos</li>
            <li>Receber notificações de novas publicações</li>
            <li>Usar nossa API para integrações</li>
        </ul>
        <p><a href="{{loginUrl}}" class="button">Acessar Sistema</a></p>
    </div>
    <div class="footer">
        <p>Dúvidas? Entre em contato: <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
    </div>
</body>
</html>`;
  }

  private getPasswordResetTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Redefinição de Senha</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 30px; }
        .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
        .alert { background: #f39c12; color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Redefinir Senha</h1>
    </div>
    <div class="content">
        <h2>Olá, {{userName}}!</h2>
        <p>Recebemos uma solicitação para redefinir sua senha.</p>
        <p><a href="{{resetUrl}}" class="button">Redefinir Senha</a></p>
        <div class="alert">
            <p><strong>Importante:</strong> Este link expira em {{expiresIn}}.</p>
        </div>
        <p>Se você não solicitou esta redefinição, ignore este email.</p>
    </div>
</body>
</html>`;
  }

  private getNewPublicationsTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Novas Publicações Encontradas</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 30px; }
        .publication { border-left: 4px solid #3498db; padding: 15px; margin: 10px 0; background: white; }
        .button { display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{publicationsCount}} Nova(s) Publicação(ões)</h1>
    </div>
    <div class="content">
        <h2>Monitor: {{monitorName}}</h2>
        <p><strong>Busca:</strong> {{searchType}} - {{searchTerm}}</p>
        
        {{#publications}}
        <div class="publication">
            <h3>{{title}}</h3>
            <p><strong>Tribunal:</strong> {{tribunal}}</p>
            <p><strong>Data:</strong> {{publishDate}}</p>
            {{#url}}<p><a href="{{url}}">Ver Publicação</a></p>{{/url}}
        </div>
        {{/publications}}
        
        {{#hasMore}}
        <p><em>... e mais {{moreCount}} publicações.</em></p>
        {{/hasMore}}
        
        <p><a href="{{dashboardUrl}}" class="button">Ver Todas no Dashboard</a></p>
        
        <hr>
        <p><small><a href="{{unsubscribeUrl}}">Cancelar este monitor</a></small></p>
    </div>
</body>
</html>`;
  }

  private getMonitorErrorTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Erro no Monitor</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 30px; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
        .button { display: inline-block; background: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Erro no Monitor</h1>
    </div>
    <div class="content">
        <h2>{{monitorName}}</h2>
        <p>Ocorreu um erro ao executar seu monitor.</p>
        
        <div class="error">
            <h3>Detalhes do Erro:</h3>
            <p><strong>Mensagem:</strong> {{errorMessage}}</p>
            <p><strong>Horário:</strong> {{timestamp}}</p>
        </div>
        
        <p>Por favor, verifique as configurações do seu monitor.</p>
        <p><a href="{{dashboardUrl}}" class="button">Verificar Monitor</a></p>
    </div>
</body>
</html>`;
  }

  private getSystemAlertTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Alerta do Sistema</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f39c12; color: white; padding: 20px; text-align: center; }
        .content { background: #f8f9fa; padding: 30px; }
        .alert { background: #f39c12; color: white; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Alerta do Sistema</h1>
    </div>
    <div class="content">
        <div class="alert">
            <h2>{{alertType}}</h2>
            <p><strong>Horário:</strong> {{timestamp}}</p>
        </div>
        <p>Detalhes adicionais disponíveis nos logs do sistema.</p>
    </div>
</body>
</html>`;
  }
}
