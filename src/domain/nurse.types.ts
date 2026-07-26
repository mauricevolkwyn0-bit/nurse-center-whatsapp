export type NurseStatus = 'pending' | 'active' | 'inactive';

export interface Nurse {
  id: string;
  whatsappNumber: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  qualifications: string;
  registrationNumber: string;
  location: string;
  status: NurseStatus;
  createdAt: string;
  updatedAt: string;
}

export type CreateNurseInput = Omit<Nurse, 'id' | 'status' | 'createdAt' | 'updatedAt'>;
export type UpdateNurseInput = Partial<Omit<Nurse, 'id' | 'createdAt'>>;
