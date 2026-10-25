"use client";

import { EmptyState } from "@/components/Bits";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState mood="confused" title="Something got knocked off the table" action={<button className="btn" onClick={reset}>Try again</button>}>
      The page could not load. Check your connection and try again. If it keeps happening, tell an admin.
    </EmptyState>
  );
}
