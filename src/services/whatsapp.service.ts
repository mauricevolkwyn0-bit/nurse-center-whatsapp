import axios from 'axios';
import { StatusCodes } from 'http-status-codes';
import config from '../config';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface SendTextOptions {
  to: string;
  body: string;
}

export interface SendInteractiveOptions {
  to: string;
  bodyText: string;
  buttons: InteractiveButton[];
  headerText?: string;
}

export class WhatsAppService {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor() {
    const { phoneNumberId, apiVersion, accessToken } = config.whatsapp;
    this.baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async sendText({ to, body }: SendTextOptions): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    });
  }

  async sendInteractiveButtons({ to, bodyText, buttons, headerText }: SendInteractiveOptions): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText && { header: { type: 'text', text: headerText } }),
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  private async post(payload: Record<string, unknown>): Promise<void> {
    try {
      await axios.post(this.baseUrl, payload, { headers: this.headers });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        logger.error('WhatsApp API error', { status: err.response?.status, data: err.response?.data });
        throw new AppError('Failed to send WhatsApp message', StatusCodes.BAD_GATEWAY);
      }
      throw err;
    }
  }
}

export const whatsappService = new WhatsAppService();
