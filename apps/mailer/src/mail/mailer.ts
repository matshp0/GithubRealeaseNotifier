import nodemailer from 'nodemailer';
import type { EmailMessage } from './templates.js';

export interface MailerConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export function createTransport(config: MailerConfig): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
}

export interface Mailer {
  sendMail(message: EmailMessage): Promise<void>;
  close(): void;
}

export function createMailer(transporter: nodemailer.Transporter): Mailer {
  return {
    async sendMail(message) {
      await transporter.sendMail(message);
    },
    close() {
      transporter.close();
    },
  };
}
