import { Injectable, Logger } from '@nestjs/common';
import { BrevoClient } from '@getbrevo/brevo';
import * as nodemailer from 'nodemailer';
import { AppConfigService } from 'src/core/config/config.service';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailTransportService {
  private readonly logger = new Logger(EmailTransportService.name);
  private brevoClient: BrevoClient | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: AppConfigService) {
    this.initBrevo();
    this.initSmtp();
  }

  private initBrevo(): void {
    const { apiKey } = this.config.email.brevo;
    if (apiKey) {
      this.brevoClient = new BrevoClient({ apiKey });
      this.logger.log('Brevo email transport initialized');
    } else {
      this.logger.warn(
        'Brevo API key not configured - Brevo transport unavailable',
      );
    }
  }

  private initSmtp(): void {
    const { host, port, user, pass } = this.config.email.smtp;
    if (user && pass) {
      this.smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('SMTP fallback transport initialized');
    } else {
      this.logger.warn(
        'SMTP credentials not configured - SMTP fallback unavailable',
      );
    }
  }

  async sendEmail(payload: SendEmailPayload): Promise<boolean> {
    // Try Brevo first
    if (this.brevoClient) {
      try {
        await this.sendViaBrevo(payload);
        this.logger.log(`Email sent via Brevo to ${payload.to}`);
        return true;
      } catch (error) {
        this.logger.error(
          `Brevo send failed for ${payload.to}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // Fall back to SMTP
    if (this.smtpTransporter) {
      try {
        await this.sendViaSmtp(payload);
        this.logger.log(`Email sent via SMTP fallback to ${payload.to}`);
        return true;
      } catch (error) {
        this.logger.error(
          `SMTP send failed for ${payload.to}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    // Both transports failed or unavailable
    this.logger.error(
      `All email transports failed for ${payload.to}. Subject: "${payload.subject}"`,
    );

    // In development, log the email content for debugging
    if (this.config.server.isDevelopment) {
      this.logger.warn(
        `[DEV] Email content for ${payload.to}:\nSubject: ${payload.subject}\n${payload.text || '(HTML only)'}`,
      );
    }

    return false;
  }

  private async sendViaBrevo(payload: SendEmailPayload): Promise<void> {
    const { senderEmail, senderName } = this.config.email.brevo;

    await this.brevoClient!.transactionalEmails.sendTransacEmail({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
    });
  }

  private async sendViaSmtp(payload: SendEmailPayload): Promise<void> {
    const { fromEmail, fromName } = this.config.email.smtp;

    await this.smtpTransporter!.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  }
}
