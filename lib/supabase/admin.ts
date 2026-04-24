import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

export const getAdminClient = cache(() =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  ),
);
