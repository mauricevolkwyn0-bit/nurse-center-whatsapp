import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import { ConversationSession, FlowId, FlowStep } from '../domain/session.types';

export interface ISessionRepository {
  findByWhatsappNumber(number: string): Promise<ConversationSession | null>;
  upsert(session: ConversationSession): Promise<ConversationSession>;
  delete(whatsappNumber: string): Promise<boolean>;
}

const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionRow {
  id: string;
  whatsapp_number: string;
  flow_id: string;
  current_step: string;
  data: Record<string, unknown>;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

function rowToSession(row: SessionRow): ConversationSession {
  return {
    id: row.id,
    whatsappNumber: row.whatsapp_number,
    flowId: row.flow_id as FlowId,
    currentStep: row.current_step as FlowStep,
    data: row.data,
    jobId: row.job_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

export class SupabaseSessionRepository implements ISessionRepository {
  async findByWhatsappNumber(number: string): Promise<ConversationSession | null> {
    const { data } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('whatsapp_number', number)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (!data) return null;
    return rowToSession(data as SessionRow);
  }

  async upsert(session: ConversationSession): Promise<ConversationSession> {
    const now = new Date();
    const row = {
      id: session.id || uuidv4(),
      whatsapp_number: session.whatsappNumber,
      flow_id: session.flowId,
      current_step: session.currentStep,
      data: session.data,
      job_id: session.jobId ?? null,
      updated_at: now.toISOString(),
      expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };

    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .upsert(row, { onConflict: 'whatsapp_number' })
      .select('*')
      .single();
    if (error) throw error;
    return rowToSession(data as SessionRow);
  }

  async delete(whatsappNumber: string): Promise<boolean> {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .delete()
      .eq('whatsapp_number', whatsappNumber);
    return !error;
  }
}

export const sessionRepository = new SupabaseSessionRepository();
