import ExcelJS from 'exceljs';
import { supabase } from './supabase';
import type { Client } from './types';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  hair: 'Hair',
  skin: 'Skin',
  hair_and_skin: 'Hair & Skin',
  custom: 'Custom',
};

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

function fmtDate(d?: string | null): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtArr(arr?: string[] | null): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

function safe(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

interface ColumnDef {
  header: string;
  width: number;
  isText?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { header: 'Client Name', width: 22 },
  { header: 'Phone', width: 16, isText: true },
  { header: 'Gender', width: 12 },
  { header: 'Age', width: 8 },
  { header: 'Date of Birth', width: 14 },
  { header: 'Blood Group', width: 14 },
  { header: 'Profession', width: 20 },
  { header: 'Address', width: 30 },
  { header: 'Service Type', width: 16 },
  { header: 'Service Items', width: 30 },
  { header: 'Oral Medical', width: 22 },
  { header: 'Skin Allergies', width: 22 },
  { header: 'Home Care', width: 22 },
  { header: 'Hair Condition', width: 22 },
  { header: 'Health Allergies', width: 22 },
  { header: 'Special Requirements', width: 25 },
  { header: 'Hair Problems', width: 22 },
  { header: 'Hair Texture', width: 18 },
  { header: 'Health Issues', width: 22 },
  { header: 'Diet Type', width: 16 },
  { header: 'Medical History', width: 25 },
  { header: 'Loyalty Points', width: 14 },
  { header: 'Golden Client', width: 14 },
  { header: 'Client Notes', width: 35 },
  { header: 'Joined Date', width: 14 },
];

interface HealthProfile {
  client_id: string;
  allergies?: string | null;
  special_requirements?: string | null;
}

interface HairProfile {
  client_id: string;
  hair_problems?: string[] | null;
  hair_texture?: string[] | null;
  health_issues?: string[] | null;
  diet_type?: string | null;
  medical_history?: string | null;
}

export async function exportClientsToExcel(clients: Client[], filename = 'clients') {
  if (!clients.length) {
    alert('No client data to export');
    return;
  }

  // Fetch health and hair profiles for these clients
  const clientIds = clients.map(c => c.id);
  const [healthRes, hairRes] = await Promise.all([
    supabase.from('health_profiles').select('client_id,allergies,special_requirements').in('client_id', clientIds),
    supabase.from('hair_profiles').select('client_id,hair_problems,hair_texture,health_issues,diet_type,medical_history').in('client_id', clientIds),
  ]);

  const healthMap = new Map<string, HealthProfile>();
  (healthRes.data || []).forEach((h: HealthProfile) => healthMap.set(h.client_id, h));

  const hairMap = new Map<string, HairProfile>();
  (hairRes.data || []).forEach((h: HairProfile) => hairMap.set(h.client_id, h));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Salon CRM';
  wb.created = new Date();

  const ws = wb.addWorksheet('Clients', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = COLUMNS.map(col => ({
    header: col.header,
    key: col.header,
    width: col.width,
    style: col.isText ? { numFmt: '@' } : undefined,
  }));

  // Style header row
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  headerRow.height = 24;

  for (const c of clients) {
    const hp = healthMap.get(c.id);
    const hr = hairMap.get(c.id);

    const row = ws.addRow({
      'Client Name': safe(c.name),
      'Phone': safe(c.phone),
      'Gender': c.gender ? (GENDER_LABELS[c.gender] ?? c.gender) : '',
      'Age': c.age != null ? c.age : '',
      'Date of Birth': fmtDate(c.dob),
      'Blood Group': safe(c.blood_group),
      'Profession': safe(c.profession),
      'Address': safe(c.address),
      'Service Type': c.service_type ? (SERVICE_TYPE_LABELS[c.service_type] ?? c.service_type) : '',
      'Service Items': fmtArr(c.service_items),
      'Oral Medical': safe(c.oral_medication),
      'Skin Allergies': safe(c.skin_allergies),
      'Home Care': safe(c.home_care),
      'Hair Condition': fmtArr(c.hair_conditions),
      'Health Allergies': safe(hp?.allergies),
      'Special Requirements': safe(hp?.special_requirements),
      'Hair Problems': fmtArr(hr?.hair_problems),
      'Hair Texture': fmtArr(hr?.hair_texture),
      'Health Issues': fmtArr(hr?.health_issues),
      'Diet Type': safe(hr?.diet_type),
      'Medical History': safe(hr?.medical_history),
      'Loyalty Points': c.loyalty_points ?? 0,
      'Golden Client': c.is_golden ? 'Yes' : 'No',
      'Client Notes': safe(c.notes),
      'Joined Date': fmtDate(c.created_at),
    });

    // Force phone column to text to prevent scientific notation
    const phoneCell = row.getCell(2);
    phoneCell.value = String(safe(c.phone));
    phoneCell.numFmt = '@';

    row.alignment = { wrapText: true, vertical: 'top' };
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
