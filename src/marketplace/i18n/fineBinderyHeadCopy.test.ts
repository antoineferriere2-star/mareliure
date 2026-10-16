import { describe, expect, it } from "vitest";
import { FINE_BINDERY_LOCALES } from "./fineBinderyLocale";
import { fineBinderyCopy } from "./fineBinderyCopy";
import { fineBinderyHeadCopy } from "./fineBinderyHeadCopy";
import { fineBinderyHomeHead } from "./fineBinderySeo";
describe("les métadonnées restent celles du contenu affiché",()=>{
 it.each(FINE_BINDERY_LOCALES)("conserve titres, descriptions, FAQ et liens pour %s",(locale)=>{
  const full=fineBinderyCopy(locale),head=fineBinderyHeadCopy(locale);
  expect(head.seo).toBe(full.seo);
  expect(head.faq).toBe(full.home.faq);
  expect(head.start).toBe(full.common.start);
  expect(head.workshops).toBe(full.nav.workshops);
  expect(head.profileNotFound).toBe(full.profile.notFound);
  const json=JSON.parse(fineBinderyHomeHead(locale).scripts[0].children);
  expect(json.mainEntity.map((entry:{name:string;acceptedAnswer:{text:string}})=>({question:entry.name,answer:entry.acceptedAnswer.text}))).toEqual(full.home.faq);
 });
});
