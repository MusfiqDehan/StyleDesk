import { afterCommit } from '../tenancy/tenant-context.js';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { BussinessInfoService } from '../bussiness-info/bussiness-info.service.js';

@Injectable()
export class MailService {
    private readonly transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly bussinessInfoService: BussinessInfoService,
    ) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('MAIL_HOST'),
            port: parseInt(this.configService.get<string>('MAIL_PORT') ?? '465'),
            secure: this.configService.get<string>('MAIL_SECURE') === 'true',
            auth: {
                user: this.configService.get<string>('MAIL_USER'),
                pass: this.configService.get<string>('MAIL_PASS'),
            },
        });
    }

    private async getBrandName(): Promise<string> {
        try {
            const info = await this.bussinessInfoService.findOne();
            const from = this.configService.get<string>('MAIL_FROM') ?? '';
            const fromName = from.includes('<') ? from.split('<')[0].trim().replace(/^"|"$/g, '') : from.trim();
            return info?.businessName?.trim() || fromName || 'Salon';
        } catch {
            return 'Salon';
        }
    }

    async sendOtpEmail(to: string, code: string, subject: string, title: string, bodyText: string): Promise<void> {
        const from = this.configService.get<string>('MAIL_FROM');
        const brandName = await this.getBrandName();
        const message = {
            from,
            to,
            subject,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #111; color: #fff; border-radius: 10px; padding: 32px;">
          <h2 style="color: #eccd80; margin-bottom: 8px;">${title}</h2>
          <p style="color: #ccc; margin-bottom: 24px;">${bodyText}</p>
          <div style="background: #1a1a1a; border: 1px solid #eccd80; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #eccd80;">${code}</span>
          </div>
          <p style="color: #888; font-size: 13px;">This code expires in <strong style="color: #eccd80;">15 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border-color: #333; margin: 24px 0;" />
          <p style="color: #555; font-size: 12px; text-align: center;">${brandName} &mdash; Your premium salon experience</p>
        </div>
      `,
        };
        afterCommit(async () => { await this.transporter.sendMail(message); });
        this.logger.log(`OTP email sent to ${to}`);
    }

    async sendSignupOtp(to: string, code: string): Promise<void> {
        const brandName = await this.getBrandName();
        await this.sendOtpEmail(
            to,
            code,
            `${brandName} – Verify Your Email`,
            'Verify Your Email',
            'Use the code below to complete your registration. Enter it on the verification page.',
        );
    }

    async sendPasswordResetOtp(to: string, code: string): Promise<void> {
        const brandName = await this.getBrandName();
        await this.sendOtpEmail(
            to,
            code,
            `${brandName} – Password Reset Code`,
            'Reset Your Password',
            'Use the code below to reset your password. If you did not request this, please ignore this email.',
        );
    }

    async sendEmailChangeOtp(to: string, code: string): Promise<void> {
        const brandName = await this.getBrandName();
        await this.sendOtpEmail(
            to,
            code,
            `${brandName} – Verify New Email`,
            'Verify Your New Email',
            'Use the code below to confirm this email address for your account. If you did not request this change, please ignore this email.',
        );
    }
}
