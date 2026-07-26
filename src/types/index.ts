export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

// ── Meta WhatsApp Cloud API webhook shapes ────────────────────────────────────

export interface MetaWebhookTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
}

export interface MetaWebhookInteractiveMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'interactive';
  interactive: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}

export type MetaWebhookMessage =
  | MetaWebhookTextMessage
  | MetaWebhookInteractiveMessage
  | { from: string; id: string; timestamp: string; type: 'image' | 'audio' | 'video' | 'document' | 'button' };

export interface MetaWebhookBody {
  object: 'whatsapp_business_account';
  entry: Array<{
    changes: Array<{
      value: {
        messages?: MetaWebhookMessage[];
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        statuses?: unknown[];
      };
    }>;
  }>;
}
