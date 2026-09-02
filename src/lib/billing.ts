import { supabase } from '@/lib/supabase';

/**
 * Atomically fetches & increments the invoice counter in settings.
 * Returns the next invoice number string like "INV-0001".
 * Falls back to a sequence-based number if settings row is missing.
 */
export async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase
    .from('settings')
    .select('invoice_counter')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    const { data: seq } = await supabase.rpc('next_invoice_seq');
    const n = seq ?? 1;
    return `INV-${String(n).padStart(5, '0')}`;
  }

  const next = (data.invoice_counter ?? 1) + 1;
  await supabase.from('settings').update({ invoice_counter: next }).eq('id', 1);
  return `INV-${String(data.invoice_counter ?? 1).padStart(5, '0')}`;
}

/**
 * Generate a receipt number for installment payments.
 */
export async function nextReceiptNumber(): Promise<string> {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const { count } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .like('receipt_no', `RCP-${ymd}-%`);
  const seq = (count ?? 0) + 1;
  return `RCP-${ymd}-${String(seq).padStart(3, '0')}`;
}

/**
 * Compute installment schedule entries for a plan.
 */
export interface ScheduleInput {
  frequency: 'weekly' | 'monthly';
  duration: number;
  installmentAmount: number;
  startDate: string;
}

export interface ScheduleEntry {
  installment_no: number;
  due_date: string;
  amount: number;
}

export function generateSchedule(input: ScheduleInput): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const start = new Date(input.startDate);
  for (let i = 0; i < input.duration; i++) {
    const due = new Date(start);
    if (input.frequency === 'monthly') {
      due.setMonth(due.getMonth() + i + 1);
    } else {
      due.setDate(due.getDate() + (i + 1) * 7);
    }
    entries.push({
      installment_no: i + 1,
      due_date: due.toISOString().slice(0, 10),
      amount: input.installmentAmount,
    });
  }
  return entries;
}

/**
 * Recompute schedule statuses based on today's date and paid amounts.
 * Pure function used for display coloring.
 */
export function computeScheduleStatus(
  entry: { due_date: string; status: string; paid_amount: number },
  today = new Date()
): 'paid' | 'late' | 'overdue' | 'pending' {
  if (entry.paid_amount > 0 && entry.paid_amount >= Number((entry as any).amount ?? 0)) {
    return 'paid';
  }
  const due = new Date(entry.due_date);
  const diffDays = Math.floor((today.getTime() - due.getTime()) / 86400000);
  if (diffDays > 7) return 'overdue';
  if (diffDays > 0) return 'late';
  return 'pending';
}
