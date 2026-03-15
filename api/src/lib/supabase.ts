import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://cclbosfyqomqnggubxyy.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_4tCisQdjYL6159epLGl_xQ_UF8bL_u-";

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function dbGet<T>(table: string, match: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await db.from(table).select("*").match(match).single();
  if (error || !data) return null;
  return data as T;
}

export async function dbList<T>(table: string, opts?: {
  match?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}): Promise<T[]> {
  let q = db.from(table).select("*");
  if (opts?.match) q = q.match(opts.match);
  if (opts?.order) q = q.order(opts.order.column, { ascending: opts.order.ascending ?? false });
  if (opts?.limit) q = q.limit(opts.limit);
  const { data } = await q;
  return (data || []) as T[];
}

export async function dbUpsert(table: string, row: Record<string, unknown>, onConflict?: string) {
  const q = onConflict
    ? db.from(table).upsert(row, { onConflict })
    : db.from(table).upsert(row);
  const { error } = await q;
  if (error) throw error;
}

export async function dbUpdate(table: string, match: Record<string, unknown>, updates: Record<string, unknown>) {
  const { error } = await db.from(table).update(updates).match(match);
  if (error) throw error;
}

export async function dbInsert(table: string, row: Record<string, unknown>) {
  const { error } = await db.from(table).insert(row);
  if (error) throw error;
}
