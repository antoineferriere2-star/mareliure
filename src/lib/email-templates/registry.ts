import type { ComponentType } from "react";
import { template as newDossierTemplate } from "./new-dossier";
import { template as publicContactTemplate } from "./public-contact";
import { template as visitorSummaryTemplate } from "./visitor-summary";
import { template as binderInvitationTemplate } from "./binder-invitation";
import { template as caseActivityTemplate } from "./case-activity";

type TemplateData = Record<string, unknown>;

export interface TemplateEntry {
  component: ComponentType<TemplateData>;
  subject: string | ((data: TemplateData) => string);
  displayName?: string;
  previewData?: TemplateData;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "new-dossier": newDossierTemplate,
  "public-contact": publicContactTemplate,
  "visitor-summary": visitorSummaryTemplate,
  "binder-invitation": binderInvitationTemplate,
  "case-activity": caseActivityTemplate,
};
