import { supabase } from '../config/supabase';
import { IRepository } from './base.repository';
import { Nurse, NurseStatus } from '../domain/nurse.types';

export interface INurseRepository extends IRepository<Nurse> {
  findByWhatsappNumber(number: string): Promise<Nurse | null>;
  findByLocation(location: string): Promise<Nurse[]>;
  findActive(): Promise<Nurse[]>;
}

function mapQualification(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes('rn') || lower.includes('registered nurse')) return 'rn';
  if (lower.includes('en') || lower.includes('enrolled nurse')) return 'en';
  if (lower.includes('hbc') || lower.includes('home based')) return 'hbc';
  if (lower.includes('na') || lower.includes('nursing assistant')) return 'na';
  if (lower.includes('cg') || lower.includes('caregiver')) return 'cg';
  return 'other';
}

function statusToVerification(status: NurseStatus): string {
  switch (status) {
    case 'active':   return 'verified';
    case 'inactive': return 'rejected';
    default:         return 'pending';
  }
}

function verificationToStatus(v: string): NurseStatus {
  switch (v) {
    case 'verified': return 'active';
    case 'rejected': return 'inactive';
    default:         return 'pending';
  }
}

interface NurseRow {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
  profiles_private: { phone: string; id_number: string | null }[];
  caregiver_profiles: {
    qualification_type: string;
    sanc_number: string | null;
    service_area: string | null;
    verification_status: string;
  }[];
}

const NURSE_SELECT = `
  id, full_name, created_at, updated_at,
  profiles_private(phone, id_number),
  caregiver_profiles(qualification_type, sanc_number, service_area, verification_status)
`;

function rowToNurse(row: NurseRow): Nurse {
  const pp = row.profiles_private[0];
  const cp = row.caregiver_profiles[0];
  const [firstName = '', ...rest] = row.full_name.split(' ');
  return {
    id: row.id,
    whatsappNumber: pp?.phone ?? '',
    firstName,
    lastName: rest.join(' '),
    idNumber: pp?.id_number ?? '',
    qualifications: cp?.qualification_type ?? 'other',
    registrationNumber: cp?.sanc_number ?? '',
    location: cp?.service_area ?? '',
    status: verificationToStatus(cp?.verification_status ?? 'pending'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseNurseRepository implements INurseRepository {
  async findById(id: string): Promise<Nurse | null> {
    const { data } = await supabase
      .from('profiles')
      .select(NURSE_SELECT)
      .eq('id', id)
      .eq('role', 'caregiver')
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return null;
    return rowToNurse(data as NurseRow);
  }

  async findAll(): Promise<Nurse[]> {
    const { data } = await supabase
      .from('profiles')
      .select(NURSE_SELECT)
      .eq('role', 'caregiver')
      .is('deleted_at', null);
    if (!data) return [];
    return (data as NurseRow[]).map(rowToNurse);
  }

  async create(data: Omit<Nurse, 'id'>): Promise<Nurse> {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      phone: data.whatsappNumber,
      phone_confirm: true,
    });

    let userId: string;
    if (authError) {
      // User already exists — look up their ID via profiles_private
      const { data: ppRows } = await supabase
        .from('profiles_private')
        .select('id')
        .eq('phone', data.whatsappNumber)
        .limit(1);
      const existing = ppRows?.[0];
      if (!existing?.id) throw new Error(authError.message);
      userId = existing.id;
    } else {
      userId = authData.user.id;
    }

    const fullName = `${data.firstName} ${data.lastName}`.trim();

    const [profileErr, privateErr, cgErr] = await Promise.all([
      supabase
        .from('profiles')
        .upsert({ id: userId, role: 'caregiver', full_name: fullName }, { onConflict: 'id' })
        .then((r) => r.error),
      supabase
        .from('profiles_private')
        .upsert({ id: userId, phone: data.whatsappNumber, id_number: data.idNumber }, { onConflict: 'id' })
        .then((r) => r.error),
      supabase
        .from('caregiver_profiles')
        .upsert(
          {
            id: userId,
            qualification_type: mapQualification(data.qualifications),
            sanc_number: data.registrationNumber,
            service_area: data.location,
            verification_status: statusToVerification(data.status ?? 'pending'),
          },
          { onConflict: 'id' },
        )
        .then((r) => r.error),
    ]);

    if (profileErr) throw profileErr;
    if (privateErr) throw privateErr;
    if (cgErr) throw cgErr;

    const nurse = await this.findById(userId);
    if (!nurse) throw new Error('Failed to retrieve created nurse');
    return nurse;
  }

  async update(id: string, data: Partial<Nurse>): Promise<Nurse | null> {
    const now = new Date().toISOString();

    if (data.firstName !== undefined || data.lastName !== undefined) {
      const current = await this.findById(id);
      if (!current) return null;
      const fullName = `${data.firstName ?? current.firstName} ${data.lastName ?? current.lastName}`.trim();
      await supabase.from('profiles').update({ full_name: fullName, updated_at: now }).eq('id', id);
    }

    if (data.whatsappNumber !== undefined || data.idNumber !== undefined) {
      const privateUpdate: Record<string, string> = { id };
      if (data.whatsappNumber !== undefined) privateUpdate.phone = data.whatsappNumber;
      if (data.idNumber !== undefined) privateUpdate.id_number = data.idNumber;
      await supabase.from('profiles_private').upsert(privateUpdate, { onConflict: 'id' });
    }

    const cgUpdate: Record<string, string> = {};
    if (data.qualifications !== undefined) cgUpdate.qualification_type = mapQualification(data.qualifications);
    if (data.registrationNumber !== undefined) cgUpdate.sanc_number = data.registrationNumber;
    if (data.location !== undefined) cgUpdate.service_area = data.location;
    if (data.status !== undefined) cgUpdate.verification_status = statusToVerification(data.status);
    if (Object.keys(cgUpdate).length > 0) {
      cgUpdate.updated_at = now;
      await supabase.from('caregiver_profiles').update(cgUpdate).eq('id', id);
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const now = new Date().toISOString();
    const [{ error: pe }, { error: ce }] = await Promise.all([
      supabase.from('profiles').update({ deleted_at: now }).eq('id', id),
      supabase.from('caregiver_profiles').update({ deleted_at: now }).eq('id', id),
    ]);
    return !pe && !ce;
  }

  async findByWhatsappNumber(number: string): Promise<Nurse | null> {
    const { data: ppRows } = await supabase
      .from('profiles_private')
      .select('id')
      .eq('phone', number)
      .limit(1);
    const id = ppRows?.[0]?.id;
    if (!id) return null;
    return this.findById(id);
  }

  async findByLocation(location: string): Promise<Nurse[]> {
    const { data: cgRows } = await supabase
      .from('caregiver_profiles')
      .select('id')
      .ilike('service_area', `%${location}%`)
      .is('deleted_at', null);
    if (!cgRows?.length) return [];

    const { data } = await supabase
      .from('profiles')
      .select(NURSE_SELECT)
      .in('id', cgRows.map((r) => r.id))
      .eq('role', 'caregiver')
      .is('deleted_at', null);
    if (!data) return [];
    return (data as NurseRow[]).map(rowToNurse);
  }

  async findActive(): Promise<Nurse[]> {
    const { data: cgRows } = await supabase
      .from('caregiver_profiles')
      .select('id')
      .eq('verification_status', 'verified')
      .is('deleted_at', null);
    if (!cgRows?.length) return [];

    const { data } = await supabase
      .from('profiles')
      .select(NURSE_SELECT)
      .in('id', cgRows.map((r) => r.id))
      .eq('role', 'caregiver')
      .is('deleted_at', null);
    if (!data) return [];
    return (data as NurseRow[]).map(rowToNurse);
  }
}

export const nurseRepository = new SupabaseNurseRepository();
