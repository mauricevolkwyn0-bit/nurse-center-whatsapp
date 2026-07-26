import { Nurse, CreateNurseInput, UpdateNurseInput } from '../domain/nurse.types';
import { INurseRepository, nurseRepository } from '../repositories/nurse.repository';
import { PaginatedResult, PaginationQuery } from '../types';
import { NotFoundError } from '../utils/AppError';

export class NurseService {
  constructor(private readonly repo: INurseRepository) {}

  async createNurse(input: CreateNurseInput): Promise<Nurse> {
    const now = new Date().toISOString();
    return this.repo.create({ ...input, status: 'pending', createdAt: now, updatedAt: now });
  }

  async getNurseById(id: string): Promise<Nurse> {
    const nurse = await this.repo.findById(id);
    if (!nurse) throw new NotFoundError('Nurse');
    return nurse;
  }

  async getNurseByWhatsappNumber(number: string): Promise<Nurse | null> {
    return this.repo.findByWhatsappNumber(number);
  }

  async getAllNurses({ page = 1, limit = 20 }: PaginationQuery): Promise<PaginatedResult<Nurse>> {
    const all = await this.repo.findAll();
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const items = all.slice((page - 1) * limit, page * limit);
    return { items, total, page, limit, totalPages };
  }

  async updateNurse(id: string, input: UpdateNurseInput): Promise<Nurse> {
    const updated = await this.repo.update(id, { ...input, updatedAt: new Date().toISOString() });
    if (!updated) throw new NotFoundError('Nurse');
    return updated;
  }

  async deleteNurse(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Nurse');
  }

  async getActiveNursesByLocation(location: string): Promise<Nurse[]> {
    const nurses = await this.repo.findByLocation(location);
    return nurses.filter((n) => n.status === 'active');
  }
}

export const nurseService = new NurseService(nurseRepository);
