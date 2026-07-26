export type FlowId = 'nurse-signup' | 'client-request' | 'job-response';

export type NurseSignupStep =
  | 'ASK_FIRST_NAME'
  | 'ASK_LAST_NAME'
  | 'ASK_ID_NUMBER'
  | 'ASK_QUALIFICATIONS'
  | 'ASK_REGISTRATION_NUMBER'
  | 'ASK_LOCATION'
  | 'CONFIRM';

export type ClientRequestStep =
  | 'ASK_CARE_TYPE'
  | 'ASK_LOCATION'
  | 'ASK_DATE'
  | 'ASK_DURATION'
  | 'CONFIRM';

export type JobResponseStep = 'AWAITING_RESPONSE';

export type FlowStep = NurseSignupStep | ClientRequestStep | JobResponseStep;

export interface ConversationSession {
  id: string;
  whatsappNumber: string;
  flowId: FlowId;
  currentStep: FlowStep;
  data: Record<string, unknown>;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}
