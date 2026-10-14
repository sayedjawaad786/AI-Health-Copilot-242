/**
 * hooks/useRotatingMessage.ts
 *
 * Returns a string from *messages* that rotates every *intervalMs* milliseconds.
 * Used for the upload progress status text.
 */

import { useEffect, useRef, useState } from "react";

export function useRotatingMessage(
  messages: readonly string[],
  intervalMs: number = 2500,
  active: boolean = true
): string {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Reset to first message when activation changes
    setIndex(0);

    if (!active || messages.length <= 1) return;

    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [active, intervalMs, messages]);

  return messages[index] ?? "";
}
