"use client";

import type { FormFeedbackState } from "@/lib/form-feedback";

type Props = {
  state: FormFeedbackState | null;
  className?: string;
};

export function FormFeedbackBanner({ state, className = "" }: Props) {
  if (!state) return null;
  if (state.error) {
    return (
      <p
        role="alert"
        aria-live="polite"
        className={`rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 ${className}`}
      >
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p
        role="status"
        aria-live="polite"
        className={`rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ${className}`}
      >
        {state.message}
      </p>
    );
  }
  return null;
}
