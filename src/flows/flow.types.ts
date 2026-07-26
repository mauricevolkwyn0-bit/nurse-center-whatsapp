import { ConversationSession, FlowId } from '../domain/session.types';
import { InteractiveButton } from '../services/whatsapp.service';

export interface FlowContext {
  session: ConversationSession;
  incomingText: string;
  interactiveReplyId?: string;
}

export type FlowReply =
  | { type: 'text'; body: string }
  | { type: 'interactive'; bodyText: string; buttons: InteractiveButton[]; headerText?: string };

export interface FlowResult {
  updatedSession: ConversationSession | null;
  reply: FlowReply;
}

export interface IFlow {
  readonly flowId: FlowId;
  start(whatsappNumber: string): Promise<FlowResult>;
  advance(context: FlowContext): Promise<FlowResult>;
}
