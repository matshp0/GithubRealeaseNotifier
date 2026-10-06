import { describe, it, expect, vi } from 'vitest';
import type nodemailer from 'nodemailer';
import { createMailer } from '../src/mail/mailer.ts';

function buildMessage() {
  return {
    from: 'from@test.com',
    to: 'user@test.com',
    subject: 'subject',
    text: 'text body',
    html: '<p>html body</p>',
  };
}

describe('createMailer', () => {
  it('delegates sendMail to the transporter', async () => {
    const transporter = {
      sendMail: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as unknown as nodemailer.Transporter;

    const mailer = createMailer(transporter);
    const message = buildMessage();
    await mailer.sendMail(message);

    expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    expect(transporter.sendMail).toHaveBeenCalledWith(message);
  });

  it('propagates transporter errors', async () => {
    const transporter = {
      sendMail: vi.fn().mockRejectedValue(new Error('SMTP down')),
      close: vi.fn(),
    } as unknown as nodemailer.Transporter;

    const mailer = createMailer(transporter);

    await expect(mailer.sendMail(buildMessage())).rejects.toThrow('SMTP down');
  });
});
