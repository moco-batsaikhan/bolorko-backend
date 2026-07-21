// mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean = false;

  constructor() {
    if (
      !process.env.MAIL_HOST ||
      !process.env.MAIL_USER ||
      !process.env.MAIL_PASS
    ) {
      this.logger.warn(
        'Mail configuration missing. Mail services will be disabled.',
      );
      this.logger.warn(
        'Please set MAIL_HOST, MAIL_USER, and MAIL_PASS environment variables.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT || 587),
        secure: Number(process.env.MAIL_PORT) === 465, // 465=true, 587=false
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
        pool: true, // продод олон имэйлд үр дүнтэй
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 10000, // 10 seconds timeout
        greetingTimeout: 5000, // 5 seconds greeting timeout
        socketTimeout: 10000, // 10 seconds socket timeout
      });

      this.isConfigured = true;

      // Only verify connection in production or when explicitly requested
      if (
        process.env.NODE_ENV === 'production' ||
        process.env.VERIFY_MAIL_CONNECTION === 'true'
      ) {
        this.verifyConnection();
      } else {
        this.logger.log('SMTP verification skipped in development mode');
        this.logger.log(
          `Mail service configured for ${process.env.MAIL_HOST} but connection verification skipped`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize mail transporter:', error);
    }
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP verify failed:', error.message);
      this.isConfigured = false;
    }
  }

  async send(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: { filename: string; content?: any; path?: string }[];
    replyTo?: string;
    bcc?: string | string[];
    cc?: string | string[];
  }) {
    if (!this.isConfigured || !this.transporter) {
      this.logger.warn(
        `Mail not configured. Would have sent email to ${options.to} with subject: "${options.subject}"`,
      );
      return {
        messageId: 'mock-' + Date.now(),
        accepted: Array.isArray(options.to) ? options.to : [options.to],
      };
    }

    try {
      const mail = await Promise.race([
        this.transporter.sendMail({
          from: process.env.MAIL_FROM || process.env.MAIL_USER,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          attachments: options.attachments,
          replyTo: options.replyTo,
          bcc: options.bcc,
          cc: options.cc,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email send timeout')), 30000),
        ),
      ]);

      this.logger.log(`Email sent successfully to ${options.to}`);
      return { messageId: mail.messageId, accepted: mail.accepted };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}:`,
        error.message,
      );

      // If it's a timeout or connection error, disable the service and return mock response
      if (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        error.code === 'ESOCKET'
      ) {
        this.logger.warn(
          'SMTP connection failed, disabling mail service for this session',
        );
        this.isConfigured = false;
        return {
          messageId: 'mock-' + Date.now(),
          accepted: Array.isArray(options.to) ? options.to : [options.to],
        };
      }

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  // Түгээмэл шаблон: тавтай морил
  async sendWelcome(to: string, name: string) {
    const html = `
      <div style="font-family:Inter,Arial">
        <p>Сайн уу, <b>${name}</b>!</p>
        <p>Манай клубт тавтай морил.</p>
      </div>`;
    return this.send({ to, subject: 'Тавтай морил!', html });
  }

  // Түгээмэл шаблон: нууц үг reset
  async sendPasswordReset(to: string, resetUrl: string) {
    const html = `
      <p>Нууц үг шинэчлэх холбоос:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>`;
    return this.send({ to, subject: 'Нууц үг шинэчлэх', html });
  }
}
