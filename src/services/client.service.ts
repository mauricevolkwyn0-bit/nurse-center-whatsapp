import { Client, CreateClientInput, UpdateClientInput } from '../domain/client.types';
import { IClientRepository, clientRepository } from '../repositories/client.repository';
import { PaginatedResult, PaginationQuery } from '../types';
import { NotFoundError } from '../utils/AppError';

export class ClientService {
  constructor(private readonly repo: IClientRepository) {}

  async createClient(input: CreateClientInput): Promise<Client> {
    const now = new Date().toISOString();
    return this.repo.create({ ...input, createdAt: now, updatedAt: now });
  }

  async getOrCreateByWhatsappNumber(number: string, name: string, location: string): Promise<Client> {
    const existing = await this.repo.findByWhatsappNumber(number);
    if (existing) return existing;
    return this.createClient({ whatsappNumber: number, name, location });
  }

  async getClientById(id: string): Promise<Client> {
    const client = await this.repo.findById(id);
    if (!client) throw new NotFoundError('Client');
    return client;
  }

  async getClientByWhatsappNumber(number: string): Promise<Client | null> {
    return this.repo.findByWhatsappNumber(number);
  }

  async getAllClients({ page = 1, limit = 20 }: PaginationQuery): Promise<PaginatedResult<Client>> {
    const all = await this.repo.findAll();
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const items = all.slice((page - 1) * limit, page * limit);
    return { items, total, page, limit, totalPages };
  }

  async updateClient(id: string, input: UpdateClientInput): Promise<Client> {
    const updated = await this.repo.update(id, { ...input, updatedAt: new Date().toISOString() });
    if (!updated) throw new NotFoundError('Client');
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Client');
  }
}

export const clientService = new ClientService(clientRepository);
