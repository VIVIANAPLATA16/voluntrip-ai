"use client";

import { useEffect, useRef, useState } from "react";
import { AIOrb } from "@/components/ui/AIOrb";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useAppStore } from "@/store/appStore";
import { t, type TranslationKey } from "@/lib/i18n/dictionaries";
import { mockConceptLabel } from "@/lib/i18n/labels";
import type { NaviState } from "@/types";
import { formatMoney } from "@/lib/constants";
import { Camera, Mic, Send } from "lucide-react";
import { analyzeReceipt } from "@/lib/ai/azureOpenAI";
import { createTransaction } from "@/lib/finance/transactions";
import { cn } from "@/lib/utils";

const QUICK: Array<{ labelKey: TranslationKey; promptKey: TranslationKey }> = [
  { labelKey: "navi.quick.afford", promptKey: "navi.quick_prompt.afford" },
  { labelKey: "navi.quick.expense", promptKey: "navi.quick_prompt.expense" },
  { labelKey: "navi.quick.spend", promptKey: "navi.quick_prompt.spend" },
  { labelKey: "navi.quick.protect", promptKey: "navi.quick_prompt.protect" },
];

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
  const addTransaction = useAppStore((s) => s.addTransaction);

  const [text, setText] = useState("");
  const [state, setState] = useState<NaviState>("idle");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [voicePreview, setVoicePreview] = useState<
    Array<{ concept: string; amount: number; currency: string }> | null
  >(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingSimulation, pendingTransaction]);

  const send = async (value?: string) => {
    const msg = (value ?? text).trim();
    if (!msg) return;
    setText("");
    setState("thinking");
    await askNavi(msg);
    setState("success");
    setTimeout(() => setState("idle"), 800);
  };

  const startVoice = () => {
    setState("listening");
    // Mock speech recognition — architecture ready for Web Speech / Azure STT
    setTimeout(() => {
      setVoicePreview([
        { concept: "Dinner", amount: 120, currency: "THB" },
        { concept: "Transport", amount: 60, currency: "THB" },
      ]);
      setState("idle");
    }, 1200);
  };

  const confirmVoice = async () => {
    if (!trip || !voicePreview) return;
    for (const item of voicePreview) {
      const tx = createTransaction({
        tripId: trip.id,
        amountOriginal: item.amount,
        currencyOriginal: item.currency as never,
        currencyBase: trip.baseCurrency,
        concept: item.concept,
        category: item.concept.toLowerCase().includes("dinner") ? "food" : "transport",
        source: "voice",
      });
      await addTransaction(tx);
    }
    setVoicePreview(null);
    setState("success");
    setTimeout(() => setState("idle"), 800);
  };

  const scanReceipt = async () => {
    setReceiptOpen(true);
    setState("thinking");
    const result = await analyzeReceipt("mock");
    if (trip) {
      setVoicePreview([
        {
          concept: result.merchant,
          amount: result.total,
          currency: result.currency,
        },
      ]);
    }
    setState("idle");
    setReceiptOpen(false);
  };

  return (
    <div className="flex w-full min-w-0 flex-col h-full min-h-[70dvh]">
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <AIOrb state={state} size="lg" />
        <p className="mt-4 text-sm text-ink-muted">
          {state === "listening"
            ? t(locale, "navi.listening")
            : state === "thinking"
              ? t(locale, "navi.thinking")
              : t(locale, "navi.tagline")}
        </p>
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

        {voicePreview && (
          <div className="rounded-card border border-border bg-surface p-4 space-y-3">
            <p className="font-semibold text-sm">{t(locale, "navi.voice_preview_title")}</p>
            <ul className="space-y-2 text-sm">
              {voicePreview.map((v, i) => (
                <li key={i} className="flex justify-between">
                  <span>{mockConceptLabel(locale, v.concept)}</span>
                  <span className="font-display font-semibold">
                    {formatMoney(v.amount, v.currency as never)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-faint">
              {t(locale, "common.total")}:{" "}
              {formatMoney(
                voicePreview.reduce((s, v) => s + v.amount, 0),
                voicePreview[0].currency as never
              )}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => void confirmVoice()}>
                {t(locale, "common.confirm")}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setVoicePreview(null)}>
                {t(locale, "common.cancel")}
              </Button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="pt-3 space-y-3 border-t border-border-subtle mt-auto">
        <div className="flex gap-2">
          <Button variant="secondary" size="icon" onClick={startVoice} aria-label={t(locale, "navi.tap_speak")}>
            <Mic className="h-5 w-5" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => void scanReceipt()} aria-label="Scan receipt">
            <Camera className="h-5 w-5" />
          </Button>
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

      <BottomSheet open={receiptOpen} onClose={() => setReceiptOpen(false)} title={t(locale, "navi.scan_receipt_title")}>
        <p className="text-sm text-ink-muted">{t(locale, "navi.scan_receipt_mock")}</p>
      </BottomSheet>
    </div>
  );
}
