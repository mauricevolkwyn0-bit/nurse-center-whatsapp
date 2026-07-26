import { supabase } from '../config/supabase';
import { IRepository } from './base.repository';
import { Client } from '../domain/client.types';

export interface IClientRepository extends IRepository<Client> {
  findByWhatsappNumber(number: string): Promise<Client | null>;
}

interface ClientRow {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
  profiles_private: { phone: string }[];
  patient_addresses: { city: string }[];
}

const CLIENT_SELECT = `
  id, full_name, created_at, updated_at,
  profiles_private(phone),
  patient_addresses(city)
`;

function rowToClient(row: ClientRow): Client {
  const pp = row.profiles_private[0];
  const addrs = row.patient_addresses;
  return {
    id: row.id,
    whatsappNumber: pp?.phone ?? '',
    name: row.full_name,
    location: addrs[0]?.city ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseClientRepository implements IClientRepository {
  async findById(id: string): Promise<Client | null> {
    const { data } = await supabase
      .from('profiles')
      .select(CLIENT_SELECT)
      .eq('id', id)
      .eq('role', 'patient')
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) return null;
    return rowToClient(data as ClientRow);
  }

  async findAll(): Promise<Client[]> {
    const { data } = await supabase
      .from('profiles')
      .select(CLIENT_SELECT)
      .eq('role', 'patient')
      .is('deleted_at', null);
    if (!data) return [];
    return (data as ClientRow[]).map(rowToClient);
  }

  async create(data: Omit<Client, 'id'>): Promise<Client> {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      phone: data.whatsappNumber,
      phone_confirm: true,
    });

    let userId: string;
    if (authError) {
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

    const [profileErr, privateErr] = await Promise.all([
      supabase
        .from('profiles')
        .upsert({ id: userId, role: 'patient', full_name: data.name }, { onConflict: 'id' })
        .then((r) => r.error),
      supabase
        .from('profiles_private')
        .upsert({ id: userId, phone: data.whatsappNumber }, { onConflict: 'id' })
        .then((r) => r.error),
    ]);

    if (profileErr) throw profileErr;
    if (privateErr) throw privateErr;

    if (data.location) {
      await supabase.from('patient_addresses').insert({
        patient_id: userId,
        label: 'WhatsApp',
        address_line: data.location,
        city: data.location,
        is_default: true,
      });
    }

    const client = await this.findById(userId);
    if (!client) throw new Error('Failed to retrieve created client');
    return client;
  }

  async update(id: string, data: Partial<Client>): Promise<Client | null> {
    const now = new Date().toISOString();

    if (data.name !== undefined) {
      await supabase.from('profiles').update({ full_name: data.name, updated_at: now }).eq('id', id);
    }
    if (data.whatsappNumber !== undefined) {
      await supabase
        .from('profiles_private')
        .upsert({ id, phone: data.whatsappNumber }, { onConflict: 'id' });
    }
    if (data.location !== undefined) {
      const { data: existing } = await supabase
        .from('patient_addresses')
        .select('id')
        .eq('patient_id', id)
        .eq('is_default', true)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('patient_addresses')
          .update({ address_line: data.location, city: data.location })
          .eq('id', existing.id);
      } else {
        await supabase.from('patient_addresses').insert({
          patient_id: id,
          label: 'WhatsApp',
          address_line: data.location,
          city: data.location,
          is_default: true,
        });
      }
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    return !error;
  }

  async findByWhatsappNumber(number: string): Promise<Client | null> {
    const { data: ppRows } = await supabase
      .from('profiles_private')
      .select('id')
      .eq('phone', number)
      .limit(1);
    const id = ppRows?.[0]?.id;
    if (!id) return null;
    return this.findById(id);
  }
}

export const clientRepository = new SupabaseClientRepository();
