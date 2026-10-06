import { workshopIntakeCopy as copy } from "@/marketplace/customer/workshopIntakeCopy";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

export function WorkshopIntakeNotice({ locale = "fr", stage }: { locale?: FineBinderyLocale; stage: "intro" | "review" | "next" }) {
  const t = copy[locale];
  return <section className="my-4 rounded-lg border border-stone-300 bg-[#fffdf8] p-5 text-stone-950" aria-label={t.title}>
    <h2 className="font-semibold">{t.title}</h2><p className="mt-2 text-sm leading-6">{t[stage]}</p>
  </section>;
}

