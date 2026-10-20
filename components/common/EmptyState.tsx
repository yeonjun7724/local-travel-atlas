import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rise-in flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-10 text-center" data-testid="empty-state">
      <span className="grid size-12 place-items-center rounded-full bg-[var(--color-sand)] text-[var(--color-muted)]">
        <SearchX aria-hidden="true" className="size-6" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {hint && <p className="mt-1 text-sm text-[var(--color-muted)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
