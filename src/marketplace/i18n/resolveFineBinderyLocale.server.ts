import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { isFineBinderyLocale, type FineBinderyLocale } from "./fineBinderyLocale";

export function fineBinderyLocaleFromPathname(pathname: string): FineBinderyLocale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isFineBinderyLocale(segment) ? segment : null;
}

export const getRequestFineBinderyLocale = createServerFn({ method: "GET" }).handler(async () => {
  return fineBinderyLocaleFromPathname(new URL(getRequest().url).pathname);
});
