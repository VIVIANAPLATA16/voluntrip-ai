import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Magic-link / OAuth PKCE callback.
 * Exchanges ?code= for a session cookie, then redirects into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/app/trip?sync=1";

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      if (supabase) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          return NextResponse.redirect(
            `${origin}/app/trip?auth_error=${encodeURIComponent(error.message)}`
          );
        }
      }
    } catch {
      return NextResponse.redirect(`${origin}/app/trip?auth_error=callback_failed`);
    }
  }

  return NextResponse.redirect(
    `${origin}${next.startsWith("/") ? next : "/app/trip?sync=1"}`
  );
}
