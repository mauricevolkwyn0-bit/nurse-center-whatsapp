export type JobStatus = 'open' | 'accepted' | 'filled' | 'cancelled';
export type CareType = 'general' | 'palliative' | 'paediatric' | 'icu' | 'other';

export const CARE_TYPES: CareType[] = ['general', 'palliative', 'paediatric', 'icu', 'other'];

export interface Job {
  id: string;
  clientId: string;
  careType: CareType;
  location: string;
  date: string;
  durationHours: number;
  status: JobStatus;
  acceptedByNurseId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateJobInput = Omit<Job, 'id' | 'status' | 'acceptedByNurseId' | 'createdAt' | 'updatedAt'>;
export type UpdateJobInput = Partial<Omit<Job, 'id' | 'createdAt'>>;
