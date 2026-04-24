export type UserRole = 'admin' | 'operator';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  blood_group?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface HealthProfile {
  id: string;
  client_id: string;
  allergies?: string;
  special_requirements?: string;
  created_at: string;
  updated_at: string;
}

export interface HairProfile {
  id: string;
  client_id: string;
  hair_problems: string[];
  hair_texture: string[];
  health_issues: string[];
  diet_type?: 'vegetarian' | 'non-vegetarian';
  medical_history?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  client_id: string;
  treatment_name: string;
  price: number;
  notes?: string;
  date: string;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  client_id: string;
  rating: number;
  comment?: string;
  date: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
