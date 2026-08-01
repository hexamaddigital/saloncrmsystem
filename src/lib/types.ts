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
  dob?: string;
  gender?: 'male' | 'female' | 'other';
  blood_group?: string;
  profession?: string;
  address?: string;
  notes?: string;
  service_type?: string;
  service_items?: string[];
  oral_medication?: string;
  skin_allergies?: string;
  home_care?: string;
  hair_conditions?: string[];
  is_golden?: boolean;
  loyalty_points?: number;
  deleted_at?: string | null;
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
  staff_name?: string;
  service_category?: string;
  payment_method?: string;
  payment_status?: 'paid' | 'pending' | 'partial';
  discount?: number;
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

export interface Appointment {
  id: string;
  client_id?: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  staff_name?: string;
  scheduled_at: string;
  duration_min?: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id?: string;
  client_name: string;
  client_phone: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method?: string;
  payment_status: 'paid' | 'pending' | 'partial';
  amount_paid: number;
  coupon_code?: string | null;
  coupon_discount?: number | null;
  notes?: string;
  invoice_date: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  staff_name?: string;
}

export interface ServiceCatalog {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_min?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  unit?: string;
  current_stock: number;
  min_stock: number;
  cost_price?: number;
  sale_price?: number;
  is_retail?: boolean;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  name: string;
  description?: string;
  price: number;
  validity_days: number;
  discount_pct?: number;
  benefits?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientMembership {
  id: string;
  client_id: string;
  membership_id: string;
  membership_name: string;
  started_at: string;
  expires_at: string;
  amount_paid: number;
  status: 'active' | 'expired' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  service_interest?: string;
  source?: string;
  status: 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost';
  notes?: string;
  follow_up_date?: string;
  assigned_to?: string;
  converted_client_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_amount?: number;
  max_uses?: number;
  uses_count: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}
