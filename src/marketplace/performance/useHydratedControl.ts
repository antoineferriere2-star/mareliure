import { useCallback, useEffect, useLayoutEffect, useState } from "react";

const useClientLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

function useDOMValue<T>(read: () => T) {
  const state = useState(read);
  const [, setValue] = state;
  // Also retain input made between the initial render and the hydration commit.
  useClientLayoutEffect(() => {
    setValue(read());
  }, [read]);
  return state;
}

export function useHydratedText(id: string) {
  const read = useCallback(() => {
    if (typeof document === "undefined") return "";
    const input = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    return input?.value ?? "";
  }, [id]);
  return useDOMValue(read);
}

export function useHydratedChecked(id: string) {
  const read = useCallback(() => {
    if (typeof document === "undefined") return false;
    const input = document.getElementById(id) as HTMLInputElement | null;
    return input?.checked ?? false;
  }, [id]);
  return useDOMValue(read);
}
