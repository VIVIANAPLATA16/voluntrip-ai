"use client";

import type { AIInsight } from "@/types";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Lightbulb, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const icons = {
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  tip: Lightbulb,
};

const badge = {
  warning: "warning" as const,
  success: "success" as const,
  info: "accent" as const,
  tip: "default" as const,
};

export function InsightCard({ insight }: { insight: AIInsight }) {
  const Icon = icons[insight.type];
  return (
    <Card className="flex gap-3 items-start" elevated>
      <div className="h-10 w-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink">{insight.title}</p>
          <Badge variant={badge[insight.type]}>NAVI</Badge>
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">{insight.message}</p>
      </div>
    </Card>
  );
}
