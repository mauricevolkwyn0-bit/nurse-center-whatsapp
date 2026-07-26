export interface Client {
  id: string;
  whatsappNumber: string;
  name: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateClientInput = Omit<Client, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateClientInput = Partial<Omit<Client, 'id' | 'createdAt'>>;
