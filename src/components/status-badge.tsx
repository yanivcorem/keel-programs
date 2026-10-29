import { Badge } from "@/components/ui/badge";

const LABELS = { on_track: "On track", drifting: "Drifting", at_risk: "At risk" } as const;
const RISK = ["None", "Watch", "Concern", "Critical"];

export function StatusBadge({ status }: { status: keyof typeof LABELS }) {
  return <Badge variant={status === "on_track" ? "secondary" : status === "drifting" ? "outline" : "destructive"}>{LABELS[status]}</Badge>;
}

export function riskLabel(level: number) {
  return RISK[level] ?? String(level);
}
