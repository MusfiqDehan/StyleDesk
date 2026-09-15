import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class PusherService {
  private readonly logger = new Logger(PusherService.name);
  private appId: string;
  private key: string;
  private secret: string;
  private cluster: string;

  constructor(private configService: ConfigService) {
    this.appId = this.configService.get<string>('PUSHER_APP_ID') || '';
    this.key = this.configService.get<string>('PUSHER_KEY') || '';
    this.secret = this.configService.get<string>('PUSHER_SECRET') || '';
    this.cluster = this.configService.get<string>('PUSHER_CLUSTER') || '';

    if (this.appId && this.key && this.secret && this.cluster) {
      this.logger.log('Pusher Service initialized (using REST API via Axios)');
    } else {
      this.logger.warn('Pusher credentials missing. Real-time notifications will be disabled.');
    }
  }

  async trigger(channel: string, event: string, data: any) {
    if (!this.appId || !this.key || !this.secret || !this.cluster || 
        this.appId === 'your_app_id' || this.key === 'your_pusher_key') {
      this.logger.warn('Pusher not properly configured (placeholders detected), skipping trigger');
      return;
    }

    try {
      const path = `/apps/${this.appId}/events`;
      const body = JSON.stringify({
        name: event,
        channels: [channel],
        data: JSON.stringify(data),
      });

      const bodyMd5 = crypto.createHash('md5').update(body).digest('hex');
      const authTimestamp = Math.floor(Date.now() / 1000);
      const authVersion = '1.0';

      const queryString = [
        `auth_key=${this.key}`,
        `auth_timestamp=${authTimestamp}`,
        `auth_version=${authVersion}`,
        `body_md5=${bodyMd5}`,
      ].join('&');

      const stringToSign = ['POST', path, queryString].join('\n');
      const authSignature = crypto
        .createHmac('sha256', this.secret)
        .update(stringToSign)
        .digest('hex');

      const url = `https://api-${this.cluster}.pusher.com${path}?${queryString}&auth_signature=${authSignature}`;

      await axios.post(url, body, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.log(`Pusher event triggered via REST: ${event} on channel ${channel}`);
    } catch (error) {
      const requestError = error as { message?: string; response?: { data?: unknown } };
      this.logger.error(`Pusher REST trigger failed: ${requestError.message ?? 'Unknown error'}`);
      if (requestError.response) {
        this.logger.error(`Response data: ${JSON.stringify(requestError.response.data)}`);
      }
    }
  }
}
