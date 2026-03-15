import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cclbosfyqomqnggubxyy.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || "sb_publishable_4tCisQdjYL6159epLGl_xQ_UF8bL_u-";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
