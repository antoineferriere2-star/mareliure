import type { FineBinderyLocale } from "./fineBinderyLocale";
import { enSeo, enHomeFaq, enProjectStart, enDirectoryLabel, enProfileNotFound } from "./locales/enHead";
import { frSeo, frHomeFaq, frProjectStart, frDirectoryLabel, frProfileNotFound } from "./locales/frHead";
import { deSeo, deHomeFaq, deProjectStart, deDirectoryLabel, deProfileNotFound } from "./locales/deHead";
import { itSeo, itHomeFaq, itProjectStart, itDirectoryLabel, itProfileNotFound } from "./locales/itHead";
import { esSeo, esHomeFaq, esProjectStart, esDirectoryLabel, esProfileNotFound } from "./locales/esHead";
const HEAD_COPY = {
  en: { seo: enSeo, faq: enHomeFaq, start: enProjectStart, workshops: enDirectoryLabel, profileNotFound: enProfileNotFound },
  fr: { seo: frSeo, faq: frHomeFaq, start: frProjectStart, workshops: frDirectoryLabel, profileNotFound: frProfileNotFound },
  de: { seo: deSeo, faq: deHomeFaq, start: deProjectStart, workshops: deDirectoryLabel, profileNotFound: deProfileNotFound },
  it: { seo: itSeo, faq: itHomeFaq, start: itProjectStart, workshops: itDirectoryLabel, profileNotFound: itProfileNotFound },
  es: { seo: esSeo, faq: esHomeFaq, start: esProjectStart, workshops: esDirectoryLabel, profileNotFound: esProfileNotFound },
};
export function fineBinderyHeadCopy(locale: FineBinderyLocale) { return HEAD_COPY[locale]; }
