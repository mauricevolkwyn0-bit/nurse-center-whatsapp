export interface IRepository<T, TId = string> {
  findById(id: TId): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: TId, data: Partial<T>): Promise<T | null>;
  delete(id: TId): Promise<boolean>;
}
