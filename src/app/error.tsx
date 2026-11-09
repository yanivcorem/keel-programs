"use client";

import { Button } from "@/components/ui/button";

// Shown when a page fails to render (for example, the database is briefly unreachable).
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm">Something went wrong loading this page. Your demo is safe.</p>
      <Button size="sm" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
