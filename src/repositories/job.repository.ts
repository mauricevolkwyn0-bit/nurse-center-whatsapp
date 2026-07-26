import { getSupabase } from '../config/supabase';
import { IRepository } from './base.repository';
import { Job, JobStatus, CareType } from '../domain/job.types';

export interface IJobRepository extends IRepository<Job> {
  findByStatus(status: JobStatus): Promise<Job[]>;
  findByClientId(clientId: string): Promise<Job[]>;
  findOpenByLocation(location: string): Promise<Job[]>;
}

const CARE_TYPE_VALUES: CareType[] = ['general', 'palliative', 'paediatric', 'icu', 'other'];

function encodeCareType(careType: CareType): string {
  return `careType:${careType}`;
}

function decodeCareType(notes: string | null): CareType {
  if (!notes) return 'other';
  const match = notes.match(/^careType:(\w+)/);
  const value = match?.[1] as CareType | undefined;
  return value && CARE_TYPE_VALUES.includes(value) ? value : 'other';
}

function statusToBooking(status: JobStatus): string {
  switch (status) {
    case 'open':      return 'pending';
    case 'accepted':  return 'confirmed';
    case 'filled':    return 'completed';
    case 'cancelled': return 'cancelled';
  }
}

function bookingToStatus(s: string): JobStatus {
  switch (s) {
    case 'confirmed':   return 'accepted';
    case 'in_progress': return 'accepted';
    case 'completed':   return 'filled';
    case 'cancelled':   return 'cancelled';
    default:            return 'open';
  }
}

const BOOKING_COLS =
  'id, patient_id, caregiver_id, status, location_name, scheduled_at, duration_hours, notes, created_at, updated_at';

interface BookingRow {
  id: string;
  patient_id: string;
  caregiver_id: string | null;
  status: string;
  location_name: string | null;
  scheduled_at: string | null;
  duration_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: BookingRow): Job {
  return {
    id: row.id,
    clientId: row.patient_id,
    careType: decodeCareType(row.notes),
    location: row.location_name ?? '',
    date: row.scheduled_at ?? '',
    durationHours: row.duration_hours ?? 0,
    status: bookingToStatus(row.status),
    acceptedByNurseId: row.caregiver_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseJobRepository implements IJobRepository {
  async findById(id: string): Promise<Job | null> {
    const { data } = await getSupabase()
      .from('bookings')
      .select(BOOKING_COLS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return null;
    return rowToJob(data as unknown as BookingRow);
  }

  async findAll(): Promise<Job[]> {
    const { data } = await getSupabase()
      .from('bookings')
      .select(BOOKING_COLS)
      .is('deleted_at', null);
    if (!data) return [];
    return (data as unknown as BookingRow[]).map(rowToJob);
  }

  async create(data: Omit<Job, 'id'>): Promise<Job> {
    const { data: booking, error } = await getSupabase()
      .from('bookings')
      .insert({
        patient_id:     data.clientId,
        caregiver_id:   data.acceptedByNurseId ?? null,
        status:         statusToBooking(data.status),
        location_name:  data.location,
        scheduled_at:   data.date,
        duration_hours: data.durationHours,
        notes:          encodeCareType(data.careType),
      })
      .select(BOOKING_COLS)
      .single();
    if (error) throw error;
    return rowToJob(booking as unknown as BookingRow);
  }

  async update(id: string, data: Partial<Job>): Promise<Job | null> {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status !== undefined)            updates.status         = statusToBooking(data.status);
    if (data.location !== undefined)          updates.location_name  = data.location;
    if (data.date !== undefined)              updates.scheduled_at   = data.date;
    if (data.durationHours !== undefined)     updates.duration_hours = data.durationHours;
    if (data.acceptedByNurseId !== undefined) updates.caregiver_id   = data.acceptedByNurseId;
    if (data.careType !== undefined)          updates.notes          = encodeCareType(data.careType);

    const { error } = await getSupabase().from('bookings').update(updates).eq('id', id);
    if (error) return null;
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await getSupabase()
      .from('bookings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    return !error;
  }

  async findByStatus(status: JobStatus): Promise<Job[]> {
    const { data } = await getSupabase()
      .from('bookings')
      .select(BOOKING_COLS)
      .eq('status', statusToBooking(status))
      .is('deleted_at', null);
    if (!data) return [];
    return (data as unknown as BookingRow[]).map(rowToJob);
  }

  async findByClientId(clientId: string): Promise<Job[]> {
    const { data } = await getSupabase()
      .from('bookings')
      .select(BOOKING_COLS)
      .eq('patient_id', clientId)
      .is('deleted_at', null);
    if (!data) return [];
    return (data as unknown as BookingRow[]).map(rowToJob);
  }

  async findOpenByLocation(location: string): Promise<Job[]> {
    const { data } = await getSupabase()
      .from('bookings')
      .select(BOOKING_COLS)
      .eq('status', 'pending')
      .ilike('location_name', `%${location}%`)
      .is('deleted_at', null);
    if (!data) return [];
    return (data as unknown as BookingRow[]).map(rowToJob);
  }
}

export const jobRepository = new SupabaseJobRepository();
