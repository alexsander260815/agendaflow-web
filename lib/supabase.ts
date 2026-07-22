import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://njdgvrkcjuscyyftioku.supabase.co";
const SUPABASE_KEY = "sb_publishable_H1BViud9sTNpEQebJ3yabA_WI20A_vf";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
