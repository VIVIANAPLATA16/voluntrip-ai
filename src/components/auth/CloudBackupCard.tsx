"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppStore } from "@/store/appStore";
import { t } from "@/lib/i18n/dictionaries";
import {
  createSupabaseBrowserClient,
  isCloudConfigured,
} from "@/lib/supabase/client";
import { syncAfterAuth } from "@/lib/sync/supabaseSync";
import { Cloud, LogOut, Mail } from "lucide-react";

export function CloudBackupCard() {
  const locale = useAppStore((s) => s.locale);
  const hydrate = useAppStore((s) => s.hydrate);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "syncing" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isCloudConfigured()) {
      setReady(true);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }

    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user ?? null);
        setReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready || !isCloudConfigured()) return;

    const authError = searchParams.get("auth_error");
    if (authError) {
      setStatus("error");
      setMessage(decodeURIComponent(authError));
      return;
    }

    const shouldSync =
      searchParams.get("sync") === "1" || searchParams.has("code");
    if (!shouldSync || !user) return;

    let cancelled = false;

    const run = async () => {
      setStatus("syncing");
      setMessage(t(locale, "cloud.syncing"));
      const result = await syncAfterAuth();
      if (cancelled) return;
      await hydrate();
      setStatus(result.ok ? "idle" : "error");
      setMessage(
        !result.ok
          ? result.message
          : result.preferredCloud
            ? t(locale, "cloud.preferred_cloud")
            : t(locale, "cloud.sync_done")
      );
      router.replace("/app/trip");
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ready, user, searchParams, locale, hydrate, router]);

  if (!isCloudConfigured()) return null;
  if (!ready) return null;

  const sendMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setStatus("sending");
    setMessage(null);

    const redirectTo = `${window.location.origin}/app/trip`;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage(t(locale, "cloud.link_sent"));
  };

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setMessage(t(locale, "cloud.signed_out"));
    setStatus("idle");
  };

  const syncNow = async () => {
    setStatus("syncing");
    setMessage(t(locale, "cloud.syncing"));
    const result = await syncAfterAuth();
    await hydrate();
    setStatus(result.ok ? "idle" : "error");
    setMessage(
      !result.ok
        ? result.message
        : result.preferredCloud
          ? t(locale, "cloud.preferred_cloud")
          : t(locale, "cloud.sync_done")
    );
  };

  return (
    <Card elevated className="space-y-3">
      <div className="flex items-center gap-2 text-ink-muted">
        <Cloud className="h-4 w-4 text-accent" aria-hidden />
        <p className="text-xs uppercase tracking-[0.18em]">{t(locale, "cloud.title")}</p>
      </div>
      <p className="text-sm text-ink-muted">{t(locale, "cloud.subtitle")}</p>

      {user ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">
            {t(locale, "cloud.signed_in_as")}{" "}
            <span className="font-medium">{user.email}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => void syncNow()}
              disabled={status === "syncing"}
            >
              {status === "syncing" ? t(locale, "cloud.syncing") : t(locale, "cloud.sync_now")}
            </Button>
            <Button
              className="flex-1"
              variant="ghost"
              onClick={() => void signOut()}
              disabled={status === "syncing"}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t(locale, "cloud.sign_out")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            type="email"
            label={t(locale, "cloud.email_label")}
            placeholder={t(locale, "cloud.email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Button
            className="w-full"
            onClick={() => void sendMagicLink()}
            disabled={status === "sending" || !email.trim()}
          >
            <Mail className="h-4 w-4" aria-hidden />
            {status === "sending" ? t(locale, "cloud.sending") : t(locale, "cloud.send_link")}
          </Button>
        </div>
      )}

      {message && (
        <p
          className={`text-xs ${status === "error" ? "text-danger" : "text-ink-faint"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </Card>
  );
}
