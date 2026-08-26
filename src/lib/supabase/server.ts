import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Supabase helpers.
 * Prefer the anon key + user cookies for auth/RLS.
 * Service role is optional and must NEVER be imported into client components.
 */

export function isCloudConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

/** Cookie-aware server client (anon key + user session). */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isCloudConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            /* Called from a Server Component — safe to ignore if middleware refreshes sessions */
          }
        },
      },
    }
  );
}

/**
 * Service-role client for privileged Route Handlers only.
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is unset.
 */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
