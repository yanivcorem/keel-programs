"use client";

import { useActionState } from "react";
import { advanceAction, resetAction, type AdvanceState } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";
import { SCRIPT } from "@/seed/script";

const SCRIPT_DAYS = Math.max(...SCRIPT.map((s) => s.simDay));

export function DemoControls({ simDay }: { simDay: number }) {
  const [state, advance, advancing] = useActionState<AdvanceState>(advanceAction, null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Demo day {simDay} of {SCRIPT_DAYS}</span>
      <form action={advance}>
        <Button type="submit" size="sm" disabled={advancing}>
          {advancing ? "Ada is working…" : "Advance to next day"}
        </Button>
      </form>
      <form action={resetAction}>
        <Button type="submit" size="sm" variant="outline">
          Reset demo
        </Button>
      </form>
      {state?.message ? <p className="w-full text-xs text-muted-foreground">{state.message}</p> : null}
    </div>
  );
}
