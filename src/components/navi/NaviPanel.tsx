"use client";

import { useEffect, useRef, useState } from "react";
import { AIOrb } from "@/components/ui/AIOrb";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useAppStore } from "@/store/appStore";
import { t, type TranslationKey } from "@/lib/i18n/dictionaries";
import type { NaviState } from "@/types";
import { formatMoney } from "@/lib/constants";
import { Camera, Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK: Array<{ labelKey: TranslationKey; promptKey: TranslationKey }> = [
  { labelKey: "navi.quick.afford", promptKey: "navi.quick_prompt.afford" },
  { labelKey: "navi.quick.expense", promptKey: "navi.quick_prompt.expense" },
  { labelKey: "navi.quick.spend", promptKey: "navi.quick_prompt.spend" },
  { labelKey: "navi.quick.protect", promptKey: "navi.quick_prompt.protect" },
];

const MAX_RECORD_MS = 20_000;

function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export function NaviPanel() {
  const locale = useAppStore((s) => s.locale);
  const messages = useAppStore((s) => s.messages);
  const askNavi = useAppStore((s) => s.askNavi);
  const pendingSimulation = useAppStore((s) => s.pendingSimulation);
  const pendingTransaction = useAppStore((s) => s.pendingTransaction);
  const confirmSimulation = useAppStore((s) => s.confirmSimulation);
  const cancelSimulation = useAppStore((s) => s.cancelSimulation);
  const confirmPendingTransaction = useAppStore((s) => s.confirmPendingTransaction);
  const cancelPendingTransaction = useAppStore((s) => s.cancelPendingTransaction);
  const trip = useAppStore((s) => s.trip);

  const [text, setText] = useState("");
  const [state, setState] = useState<NaviState>("idle");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingSimulation, pendingTransaction, errorBanner]);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      recordingRef.current = false;
      if (recordTimerRef.current) clearTimeout(recordTimerRef.current);
    };
  }, []);

  const stopMediaTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingRef.current = false;
  };

  const showError = (key: TranslationKey) => {
    setErrorBanner(t(locale, key));
    setState("error");
    setTimeout(() => setState("idle"), 1200);
  };

  const send = async (value?: string) => {
    const msg = (value ?? text).trim();
    if (!msg) return;
    setErrorBanner(null);
    setText("");
    setState("thinking");
    await askNavi(msg);
    setState("success");
    setTimeout(() => setState("idle"), 800);
  };

  const finishRecording = async (blob: Blob) => {
    stopMediaTracks();
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (!blob.size) {
      showError("navi.speech_failed");
      return;
    }

    setState("thinking");
    try {
      const form = new FormData();
      form.append("audio", blob, "speech.webm");
      form.append("locale", locale);

      const res = await fetch("/api/navi/speech", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text?.trim()) {
        showError("navi.speech_failed");
        return;
      }

      await send(data.text.trim());
    } catch {
      showError("navi.speech_failed");
    }
  };

  const stopVoice = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopMediaTracks();
      setState("idle");
    }
  };

  const startVoice = async () => {
    setErrorBanner(null);

    if (recordingRef.current) {
      stopVoice();
      return;
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      showError("navi.mic_denied");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      showError("navi.speech_failed");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingRef.current = true;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        void finishRecording(blob);
      };

      recorder.start();
      setState("listening");

      recordTimerRef.current = setTimeout(() => {
        if (recordingRef.current) stopVoice();
      }, MAX_RECORD_MS);
    } catch (err) {
      stopMediaTracks();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        showError("navi.mic_denied");
      } else {
        showError("navi.speech_failed");
      }
    }
  };

  const processReceiptFile = async (file: File) => {
    setErrorBanner(null);
    setReceiptOpen(true);
    setState("thinking");

    try {
      const dataUrl = await fileToDataUrl(file);
      if (!dataUrl) {
        showError("navi.ocr_failed");
        setReceiptOpen(false);
        return;
      }

      const res = await fetch("/api/navi/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = (await res.json()) as { text?: string; error?: string };

      setReceiptOpen(false);

      if (!res.ok || !data.text?.trim()) {
        showError("navi.ocr_failed");
        return;
      }

      const prompt = t(locale, "navi.receipt_prompt", { text: data.text.trim() });
      await send(prompt);
    } catch {
      setReceiptOpen(false);
      showError("navi.ocr_failed");
    }
  };

  const openReceiptPicker = () => {
    setErrorBanner(null);
    fileInputRef.current?.click();
  };

  return (
    <div className="flex w-full min-w-0 flex-col h-full min-h-[70dvh]">
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <AIOrb state={state} size="lg" />
        <p className="mt-4 text-sm text-ink-muted">
          {state === "listening"
            ? t(locale, "navi.listening")
            : state === "thinking"
              ? receiptOpen
                ? t(locale, "navi.processing_receipt")
                : t(locale, "navi.thinking")
              : t(locale, "navi.tagline")}
        </p>
        {state === "listening" && (
          <p className="mt-1 text-xs text-ink-faint">{t(locale, "navi.tap_to_stop")}</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5 w-full min-w-0 pb-3">
        {QUICK.map((q) => {
          const prompt = t(locale, q.promptKey);
          return (
            <button
              key={q.promptKey}
              type="button"
              title={prompt}
              onClick={() => void send(prompt)}
              className="min-w-0 h-9 px-1 rounded-full border border-border bg-surface text-[10px] sm:text-xs leading-tight text-ink-muted hover:text-accent hover:border-accent/40 touch-target whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {t(locale, q.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto space-y-3 py-2 min-h-[200px] max-h-[40dvh] md:max-h-none">
        {messages.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-8">
            {t(locale, "navi.empty_state_hint")}
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[90%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
              m.role === "user"
                ? "ml-auto bg-accent text-bg"
                : "mr-auto bg-surface border border-border text-ink"
            )}
          >
            {m.content}
          </div>
        ))}

        {errorBanner && (
          <div
            role="alert"
            className="rounded-card border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
          >
            {errorBanner}
          </div>
        )}

        {pendingSimulation && (
          <div className="rounded-card border border-accent/30 bg-accent-soft/30 p-4 space-y-3">
            <p className="text-sm font-semibold">{t(locale, "navi.purchase_simulation")}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-faint">{t(locale, "navi.sim_available")}</p>
                <p className="font-display font-semibold">
                  {formatMoney(pendingSimulation.availableBefore, trip?.baseCurrency || "USD")}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">{t(locale, "navi.sim_after")}</p>
                <p className="font-display font-semibold">
                  {formatMoney(pendingSimulation.availableAfter, trip?.baseCurrency || "USD")}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">{t(locale, "navi.sim_daily_now")}</p>
                <p>{formatMoney(pendingSimulation.dailyBudgetBefore, trip?.baseCurrency || "USD")}</p>
              </div>
              <div>
                <p className="text-xs text-ink-faint">{t(locale, "navi.sim_daily_after")}</p>
                <p>{formatMoney(pendingSimulation.dailyBudgetAfter, trip?.baseCurrency || "USD")}</p>
              </div>
            </div>
            <p className="text-sm text-ink-muted">{pendingSimulation.impactMessage}</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void confirmSimulation()}>
                {t(locale, "navi.confirm_purchase")}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={cancelSimulation}>
                {t(locale, "common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {pendingTransaction && (
          <div className="rounded-card border border-border bg-surface p-4 space-y-3">
            <p className="font-semibold text-sm">{t(locale, "navi.confirm_expense")}</p>
            <p>
              {pendingTransaction.concept}:{" "}
              {formatMoney(
                pendingTransaction.amountOriginal,
                pendingTransaction.currencyOriginal
              )}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void confirmPendingTransaction()}>
                {t(locale, "common.confirm")}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={cancelPendingTransaction}>
                {t(locale, "common.cancel")}
              </Button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="pt-3 space-y-3 border-t border-border-subtle mt-auto">
        <div className="flex gap-2">
          <Button
            variant={state === "listening" ? "primary" : "secondary"}
            size="icon"
            onClick={() => void startVoice()}
            aria-label={t(locale, "navi.tap_speak")}
            aria-pressed={state === "listening"}
          >
            <Mic className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={openReceiptPicker}
            aria-label={t(locale, "navi.scan_receipt_aria")}
            disabled={state === "listening" || state === "thinking"}
          >
            <Camera className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void processReceiptFile(file);
            }}
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder={t(locale, "navi.placeholder")}
            className="flex-1 h-12 px-4 rounded-2xl bg-bg-elevated border border-border text-ink"
            aria-label="Message NAVI"
          />
          <Button size="icon" onClick={() => void send()} aria-label="Send">
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-center text-xs text-ink-faint">{t(locale, "navi.tap_speak")}</p>
      </div>

      <BottomSheet
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title={t(locale, "navi.scan_receipt_title")}
      >
        <p className="text-sm text-ink-muted">{t(locale, "navi.processing_receipt")}</p>
      </BottomSheet>
    </div>
  );
}
