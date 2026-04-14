import { useRef, useCallback, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave(
  saveFn: (value: string) => Promise<void>,
  debounceMs = 500,
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const doSave = useCallback(
    async (value: string) => {
      cancel();
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      setStatus("saving");
      try {
        await saveFn(value);
        setStatus("saved");
        savedTimerRef.current = setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("error");
      }
    },
    [saveFn, cancel],
  );

  const save = useCallback(
    (value: string) => {
      cancel();
      timerRef.current = setTimeout(() => doSave(value), debounceMs);
    },
    [doSave, debounceMs, cancel],
  );

  const saveImmediately = useCallback(
    (value: string) => {
      cancel();
      doSave(value);
    },
    [doSave, cancel],
  );

  return { save, saveImmediately, cancel, status };
}
