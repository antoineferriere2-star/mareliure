/* eslint-disable react-refresh/only-export-components -- localizeField is exported for unit testing */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FIELD_COMPONENTS, type InspirationPhotoAnalysis } from "@/build/engine/fields";
import { PhotoThumb } from "@/build/engine/fields/PhotoField";
import { createPhotoPreviewStore } from "@/build/engine/fields/photoPreviews";
import type { PhotoPreviewStore, PhotoShot } from "@/build/engine/fields/types";
import { computeVisibleSteps, validateField, type VisibleStep } from "@/build/engine/validation";
import { describeProgress, resumeStepIndex } from "@/build/engine/progress";
import { findGlossaryEntries } from "@/build/engine/glossary";
import {
  evaluatePlaybookConsistency,
  evaluateStepConsistency,
  gateOnConsistency,
  type TriggeredConsistency,
} from "@/build/engine/consistency";
import { formatAnswerForDisplay } from "@/build/engine/brief";
import {
  NOT_SURE_VALUE,
  type Answers,
  type AnswerValue,
  type PhotoAnswerEntry,
} from "@/build/schema/answers";
import type { ProjectBrief } from "@/build/schema/brief";
import type { VisitorProjectSummary } from "@/build/schema/visitorSummary";
import type { PlaybookSchema } from "@/build/schema/playbook";
import type { PlaybookField } from "@/build/schema/playbook";
import {
  clearStoredAuth,
  loadStoredAuth,
  storeAuth,
  type SessionAuth,
} from "./publicSessionStorage";
import { VisitorProjectSummaryView } from "./VisitorProjectSummaryView";
import { BuildPublicShell, type PublicShellLinks } from "./BuildPublicShell";
import { ProjectCanvas, ProjectCanvasMobileSheet } from "./ProjectCanvas";
import { projectCanvasItemsFromRuntime } from "./ProjectCanvasProjection";
import { EMPTY_BRANDING, type PublicBranding } from "@/build/branding/missionBranding";
import { readableTextColor } from "@/build/branding/contrast";
import { publicCopy, usePublicLocale } from "./publicLocaleContext";
import { isSupportedLocale, type SupportedLocale } from "@/build/i18n";
import { MissionRuntimeSkeleton } from "./MissionRuntimeStates";
import { StepGlossary } from "./StepGlossary";
import { formatProgress } from "./progressLabel";
import type { IntakeGuidance } from "./intakeGuidance";

/** How long the initial load can run before we tell the visitor it's taking
 * longer than usual — long enough to not fire on a normal cold start, short
 * enough that nobody stares at a silent skeleton for a full minute. */
const SLOW_LOAD_MS = 8000;

/**
 * The language a Mission declares, or null to let the visitor choose.
 *
 * `proposal` arrives as untrusted JSON on a public endpoint, so an unknown or
 * malformed locale reads as "not declared" rather than throwing on the one
 * surface a visitor is actively using.
 */
function missionLocale(mission: {
  proposal?: { defaultLocale?: string } | null;
}): SupportedLocale | null {
  const declared = mission.proposal?.defaultLocale;
  return isSupportedLocale(declared) ? declared : null;
}

type PublicMission = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  playbook_id: string | null;
  playbook_name: string | null;
  proposal: { intro?: string; defaultLocale?: string } | null;
  /** The business publishing this intake — what the visitor should see. */
  workspace_name: string | null;
  /** Frozen at publish time. Every field may be null on an Intake published
   * before branding was captured; each one falls back to what was shown then. */
  branding: PublicBranding | null;
};

type DossierResult = {
  id: string;
  status: string;
  summary: string | null;
  content: ProjectBrief;
  next_questions: string[];
  visitor_summary: VisitorProjectSummary;
  emailSent?: boolean;
  summaryUrl?: string | null;
};

type CopyFn = (text: string) => string;

export function localizeField(field: PlaybookField, copy: CopyFn): PlaybookField {
  const localized = { ...field } as PlaybookField & Record<string, unknown>;
  localized.label = copy(field.label);
  if (typeof localized.helpText === "string") localized.helpText = copy(localized.helpText);
  if (Array.isArray(localized.options)) {
    localized.options = localized.options.map((option) => {
      if (typeof option === "string") return copy(option);
      if (option && typeof option === "object" && "label" in option) {
        return {
          ...option,
          label: copy(String(option.label)),
          // Missed until now, the same way `components`/`ranges` below once
          // were: an option's reassurance renders straight from the Playbook
          // (SingleChoiceField.tsx, MultiChoiceField.tsx) with no localizing
          // step of its own.
          ...("reassurance" in option && typeof option.reassurance === "string"
            ? { reassurance: copy(option.reassurance) }
            : {}),
        };
      }
      return option;
    });
  }
  // Address fields carry their sub-labels (ZIP code, City / State) in
  // `components`, not `options` — missed by the block above.
  if (Array.isArray(localized.components)) {
    localized.components = localized.components.map((component) =>
      component && typeof component === "object" && "label" in component
        ? { ...component, label: copy(String(component.label)) }
        : component,
    );
  }
  // Budget fields in "ranges" mode carry their choices in `ranges`, a
  // separate array from `options` used by every other choice-style field.
  if (Array.isArray(localized.ranges)) {
    localized.ranges = localized.ranges.map((range) =>
      range && typeof range === "object" && "label" in range
        ? { ...range, label: copy(String(range.label)) }
        : range,
    );
  }
  // Consent fields show their own copy of the agreement text separately
  // from `label`.
  if (typeof localized.consentText === "string") {
    localized.consentText = copy(localized.consentText);
  }
  return localized as PlaybookField;
}

/**
 * `validateField` (engine/validation.ts) is deliberately i18n-free — it
 * returns an English sentence with the field's (or, for address fields, a
 * component's) English label quoted inside, e.g. `"ZIP code" is not valid.`.
 * The dictionary can't translate that whole sentence directly since the
 * quoted label and any counts vary per field. Instead: mask the label and
 * any numbers out into placeholders, translate the resulting fixed template
 * via `copy()`, then splice the (separately localized) label and numbers
 * back in.
 */
export function localizeValidationMessage(
  message: string,
  field: PlaybookField,
  copy: CopyFn,
): string {
  // An address is validated as a whole ("<label> is required.") and per
  // component ("ZIP code is not valid."), so either label can be the quoted one.
  const labelCandidates =
    field.type === "address"
      ? [field.label, ...field.components.map((c) => c.label)]
      : [field.label];

  let template = message;
  let localizedLabel: string | null = null;
  for (const label of labelCandidates) {
    const quoted = `"${label}"`;
    if (template.includes(quoted)) {
      template = template.replace(quoted, '"{field}"');
      localizedLabel = copy(label);
      break;
    }
  }

  const numbers: string[] = [];
  template = template.replace(/\d+/g, (match) => {
    numbers.push(match);
    return `{n${numbers.length - 1}}`;
  });

  let translated = copy(template);
  if (localizedLabel) translated = translated.replace("{field}", localizedLabel);
  numbers.forEach((n, i) => {
    translated = translated.replace(`{n${i}}`, n);
  });
  return translated;
}

async function callRuntime<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/public/build-runtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : "Runtime error");
  }
  return payload as T;
}

/** A triggered consistency rule, reduced to what the visitor is shown. */
type ConsistencyNotice = { id: string; message: string };

function toNotices(rules: { id: string; message: string }[]): ConsistencyNotice[] {
  return rules.map((rule) => ({ id: rule.id, message: rule.message }));
}

/**
 * Generic Mission runtime: given a public_token, drives the hardened public
 * API (start/resume/save/submit) and renders whatever PlaybookSchema comes
 * back via the generic field component registry. No business logic lives
 * here — every question, option, validation rule and brief mapping comes
 * from the Playbook itself.
 */
/**
 * What a route may place after the submitted summary. The runtime passes the
 * address the visitor typed and nothing else; the route decides what to do
 * with it. No Mission knows which product it runs in.
 */
export type RenderAfterSubmission = (context: { visitorEmail: string | null }) => ReactNode;

function visitorEmailFrom(answers: Answers): string | null {
  return typeof answers.email === "string" && answers.email.trim() ? answers.email.trim() : null;
}

export function MissionRuntime({
  publicToken,
  renderAfterSubmission,
  seedAnswers,
  guidance,
  initialLocale,
  routeLocaleWins = false,
  shellLinks,
}: {
  publicToken: string;
  renderAfterSubmission?: RenderAfterSubmission;
  /**
   * What the deployment wants said around the questions — a promise up front,
   * photo views to capture, words to explain, a reminder before sending. The
   * runtime places these and never reads them: see intakeGuidance.ts.
   */
  guidance?: IntakeGuidance;
  /**
   * The language to speak until the Mission says its own. A Mission declares its
   * language in the payload this component is still fetching, so the skeleton
   * and — worse — the "could not load" card would otherwise appear in English to
   * a French visitor, at the one moment they most need to understand the page.
   * The route knows which Mission it serves; the Mission's own declaration
   * still wins once it arrives.
   */
  initialLocale?: SupportedLocale;
  /** A localized public route can deliberately override a legacy Mission locale. */
  routeLocaleWins?: boolean;
  shellLinks?: PublicShellLinks;
  /**
   * Answers to merge in when a fresh session starts (never on resume) — the
   * generic half of carrying an opaque tag through the tunnel. The runtime
   * does not interpret these keys; it only forwards them, exactly as it
   * already forwards whatever a visitor types into a real Playbook field.
   */
  seedAnswers?: Record<string, string>;
}) {
  // The header needs the business's name, which only arrives with the mission
  // fetched by the content below — so it is lifted here rather than fetched
  // twice.
  const [businessName, setBusinessName] = useState<string | null>(null);
  // Same lift, same reason: the Mission may declare the language it is written
  // in, and the shell owns the locale provider that has to apply it.
  const [missionLocale, setMissionLocale] = useState<SupportedLocale | null>(null);
  return (
    // No FAQ launcher here — this is the actual Guided Project Intake a
    // visitor is completing; a persistent "Questions?" button would
    // dilute the product demo itself.
    //
    // `embedded` chrome: this page is normally an iframe inside the
    // business's own website. Métré Build's marketing nav has no business
    // being there.
    <BuildPublicShell
      showFaqLauncher={false}
      chrome="embedded"
      businessName={businessName}
      links={shellLinks}
      lockedLocale={routeLocaleWins ? (initialLocale ?? missionLocale) : (missionLocale ?? initialLocale ?? null)}
    >
      <MissionRuntimeContent
        publicToken={publicToken}
        onBusinessName={setBusinessName}
        onMissionLocale={setMissionLocale}
        renderAfterSubmission={renderAfterSubmission}
        seedAnswers={seedAnswers}
        guidance={guidance}
      />
    </BuildPublicShell>
  );
}

function MissionRuntimeContent({
  publicToken,
  onBusinessName,
  onMissionLocale,
  renderAfterSubmission,
  seedAnswers,
  guidance,
}: {
  publicToken: string;
  onBusinessName: (name: string | null) => void;
  onMissionLocale: (locale: SupportedLocale | null) => void;
  renderAfterSubmission?: RenderAfterSubmission;
  seedAnswers?: Record<string, string>;
  guidance?: IntakeGuidance;
}) {
  const { locale } = usePublicLocale();
  const copy = useCallback((text: string) => publicCopy(locale, text), [locale]);
  // Thumbnails of what the visitor picked, shared by the photo fields and the
  // recap. One store for the whole session: a field unmounts on every step
  // change, and the pictures must outlive it.
  const [photoPreviews] = useState(() => createPhotoPreviewStore());
  useEffect(() => () => photoPreviews.dispose(), [photoPreviews]);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [mission, setMission] = useState<PublicMission | null>(null);
  const [schema, setSchema] = useState<PlaybookSchema | null>(null);
  const [sessionAuth, setSessionAuth] = useState<SessionAuth | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  // The last screen before submitting. Not a step in the Playbook — the
  // homepage has promised visitors "a clear recap before submission" all
  // along, and there was none.
  const [reviewing, setReviewing] = useState(false);
  // Triggered consistency rules. Errors block; a warning is shown once and may
  // then be moved past — acknowledgement is sticky for the session so a
  // visitor who has read one is never asked to dismiss it again.
  const [consistencyErrors, setConsistencyErrors] = useState<ConsistencyNotice[]>([]);
  const [consistencyWarnings, setConsistencyWarnings] = useState<ConsistencyNotice[]>([]);
  const [acknowledgedRuleIds, setAcknowledgedRuleIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState<DossierResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slowLoad, setSlowLoad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // The visitor came back to a saved session and was placed on the step they had
  // reached. Said once, and gone as soon as they move.
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSlowLoad(false);
    setError(null);
    const slowLoadTimer = window.setTimeout(() => {
      if (!cancelled) setSlowLoad(true);
    }, SLOW_LOAD_MS);

    async function startFresh() {
      const data = await callRuntime<{
        mission: PublicMission;
        playbook_schema: PlaybookSchema;
        session: { id: string; answers: Answers; status: string };
        session_secret: string;
      }>({ action: "start_session", public_token: publicToken });
      if (cancelled) return;
      const auth = { sessionId: data.session.id, secret: data.session_secret };
      storeAuth(publicToken, auth);
      setMission(data.mission);
      onBusinessName(data.mission.workspace_name);
      onMissionLocale(missionLocale(data.mission));
      setSchema(data.playbook_schema);
      setSessionAuth(auth);
      const initialAnswers = { ...(data.session.answers ?? {}), ...seedAnswers };
      setAnswers(initialAnswers);
      if (seedAnswers && Object.keys(seedAnswers).length > 0) {
        // Best-effort: a referral tag lost to a transient network error just
        // means this session is never resolved as BINDER_REFERRED — never a
        // security question, see reconcileCaseTriage. Fired directly against
        // the freshly minted auth rather than through `persist`, whose
        // closure would still see the stale (null) sessionAuth state here.
        void callRuntime({
          action: "save_session",
          session_id: auth.sessionId,
          session_secret: auth.secret,
          answers: initialAnswers,
        }).catch(() => {});
      }
    }

    (async () => {
      const stored = loadStoredAuth(publicToken);
      try {
        if (!stored) {
          await startFresh();
          return;
        }
        const data = await callRuntime<{
          mission: PublicMission;
          playbook_schema: PlaybookSchema;
          session: { id: string; answers: Answers; status: string };
          dossier?: DossierResult;
        }>({
          action: "resume_session",
          session_id: stored.sessionId,
          session_secret: stored.secret,
        });
        if (cancelled) return;
        setMission(data.mission);
        onBusinessName(data.mission.workspace_name);
        onMissionLocale(missionLocale(data.mission));
        setSchema(data.playbook_schema);
        setSessionAuth(stored);
        const resumedAnswers = data.session.answers ?? {};
        setAnswers(resumedAnswers);
        // Land where the visitor left off, not on the first screen: the
        // answers come back, and pressing Continue past every finished step
        // was the price of having closed the tab.
        if (!data.dossier && Object.keys(resumedAnswers).length > 0) {
          const landing = resumeStepIndex(
            computeVisibleSteps(data.playbook_schema, resumedAnswers),
            resumedAnswers,
          );
          setStepIndex(landing);
          setResumed(landing > 0);
        }
        if (data.dossier) setDossier(data.dossier);
      } catch {
        // Stored session is gone/invalid — fall back to a fresh one.
        clearStoredAuth(publicToken);
        try {
          await startFresh();
        } catch {
          if (!cancelled) setError(copy("Unable to load mission"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slowLoadTimer);
    };
    // onBusinessName is a setState setter, so its identity is stable and
    // listing it never re-runs the load. seedAnswers must stay referentially
    // stable across re-renders for the same reason (the route memoises it on
    // its search param) — listed here so a *real* change (a different `ref`)
    // does start a fresh session, which is the correct behaviour.
  }, [publicToken, reloadKey, onBusinessName, onMissionLocale, seedAnswers]);

  // A refused Continue must be seen. The message sits at the top of the card
  // while the button that caused it sits at the bottom of the screen — on a
  // phone, that is a tap that appears to do nothing.
  useEffect(() => {
    if (error || consistencyErrors.length > 0) {
      errorRef.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    }
  }, [error, consistencyErrors]);

  function retryLoad() {
    // Bump the effect's dependency rather than clearing storage first — a
    // stored session might still be valid and this was just a transient
    // network failure; the effect's own catch already falls back to a
    // fresh session if the stored one turns out to be genuinely invalid.
    setReloadKey((key) => key + 1);
  }

  /**
   * "Start another project", from the summary screen.
   *
   * The session is remembered in localStorage so a visitor who closes the tab
   * mid-way comes back to where they left off. After submitting, that same
   * memory became a trap: every visit to the intake reopened the finished
   * summary, and the only way to describe a second book was clearing site
   * data by hand.
   *
   * Forgetting the local session is enough. The submitted Dossier is untouched
   * on the server, and the visitor already holds its secure summary link. The
   * effect then starts a fresh session exactly as on a first visit.
   */
  function startNewProject() {
    clearStoredAuth(publicToken);
    photoPreviews.dispose();
    setDossier(null);
    setAnswers({});
    setStepIndex(0);
    setResumed(false);
    setReviewing(false);
    setConsistencyErrors([]);
    setConsistencyWarnings([]);
    setAcknowledgedRuleIds([]);
    setFieldErrors({});
    setReloadKey((key) => key + 1);
    window.scrollTo({ top: 0 });
  }

  const visibleSteps = useMemo<VisibleStep[]>(
    () => (schema ? computeVisibleSteps(schema, answers) : []),
    [schema, answers],
  );
  const clampedStepIndex = Math.min(stepIndex, Math.max(visibleSteps.length - 1, 0));
  const currentStep = visibleSteps[clampedStepIndex];

  // Branding frozen onto the Mission at publish time. Null on anything
  // published before it was captured, and every read below falls back to what
  // that Intake already showed.
  const branding = mission?.branding ?? EMPTY_BRANDING;
  const accent = branding.accentColor;
  // The customer picks the background; we pick the text. White on a light
  // brand colour is unreadable, and this runs on the customer's own site.
  const accentStyle = accent
    ? { backgroundColor: accent, color: readableTextColor(accent) }
    : undefined;
  // Posées seulement quand la Mission déclare une couleur. Le repli était
  // écrit ici, en style inline, ce qui battait toute feuille de style : un
  // déploiement pouvait redéfinir `--metre-accent`, la valeur inline gagnait
  // et la barre de progression restait verte. Sans Mission qui en décide, la
  // variable retombe sur ce que le document a défini — le vert de Métré dans
  // `:root`, autre chose sous une autre marque.
  const accentVariables = accent
    ? ({
        "--metre-accent": accent,
        "--metre-accent-soft": `color-mix(in oklab, ${accent} 12%, white)`,
      } as CSSProperties)
    : undefined;
  const progress = useMemo(
    () =>
      schema
        ? describeProgress({ schema, answers, steps: visibleSteps, index: clampedStepIndex })
        : null,
    [schema, answers, visibleSteps, clampedStepIndex],
  );
  const isLastStep = clampedStepIndex >= visibleSteps.length - 1;
  // Words this step actually uses, from the Playbook's own text — not from what
  // the visitor typed, and not translated: the glossary is the deployment's.
  const glossaryEntries = useMemo(
    () =>
      guidance?.glossary && currentStep && !reviewing
        ? findGlossaryEntries(stepTexts(currentStep), guidance.glossary)
        : [],
    [guidance?.glossary, currentStep, reviewing],
  );
  const canvasItems = useMemo(
    () =>
      projectCanvasItemsFromRuntime(
        visibleSteps,
        answers,
        copy,
        reviewing ? visibleSteps.length - 1 : clampedStepIndex,
      ),
    [answers, clampedStepIndex, copy, reviewing, visibleSteps],
  );
  const capturedCount = canvasItems.filter((item) => item.status !== "clarify").length;

  function setAnswer(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // A consistency notice describes a combination of answers, so any edit may
    // have resolved it. Clear and let the next Continue re-evaluate.
    setConsistencyErrors([]);
    setConsistencyWarnings([]);
  }

  async function persist(next: Answers) {
    if (!sessionAuth) return;
    try {
      await callRuntime({
        action: "save_session",
        session_id: sessionAuth.sessionId,
        session_secret: sessionAuth.secret,
        answers: next,
      });
    } catch {
      setError(copy("Unable to save answers"));
    }
  }

  /** Shows what the Vérificateur found and reports whether the visitor may move on — the policy itself lives in the engine. */
  function clearsConsistency(rules: TriggeredConsistency) {
    const gate = gateOnConsistency(rules, acknowledgedRuleIds);
    setConsistencyErrors(toNotices(gate.errors));
    setConsistencyWarnings(toNotices(gate.newWarnings));
    if (gate.newWarnings.length > 0) {
      setAcknowledgedRuleIds((prev) => [...prev, ...gate.newWarnings.map((rule) => rule.id)]);
    }
    return gate.proceed;
  }

  async function goNext() {
    if (!currentStep) return;
    const errors: Record<string, string> = {};
    for (const field of currentStep.visibleFields) {
      const message = validateField(field, answers[field.key]);
      if (message) errors[field.key] = localizeValidationMessage(message, field, copy);
    }
    const blockingKeys = Object.keys(errors);
    if (blockingKeys.length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }));
      // Per-field messages are the primary signal, but they only help if the
      // field renders them. A Playbook can put the blocking field somewhere a
      // visitor does not connect with the button — and a component that drops
      // the `error` prop would make Continue look simply dead. Naming the
      // fields at the top guarantees the visitor always learns *why* nothing
      // happened, whatever the field is.
      const labels = currentStep.visibleFields
        .filter((field) => blockingKeys.includes(field.key))
        .map((field) => copy(field.label));
      // A consent field is labelled by its whole sentence, which already ends
      // in a full stop — don't add a second one.
      const named = labels.join(", ").replace(/[.\s]+$/, "");
      setError(`${copy("Please check the following before continuing:")} ${named}.`);
      return;
    }

    // Every field on this step is individually valid — now ask the Playbook
    // whether they hold together, and whether they contradict an earlier step.
    // Only steps the visitor has actually seen count as answered.
    if (schema) {
      const reached = visibleSteps.slice(0, clampedStepIndex + 1).map((s) => s.step.id);
      const stepRules = evaluateStepConsistency(schema, answers, currentStep.step.id, reached);
      if (!clearsConsistency(stepRules)) {
        setError(null);
        return;
      }
    }

    setError(null);
    setSaving(true);
    await persist(answers);
    setSaving(false);
    if (isLastStep) {
      // Playbook-scoped rules span the whole journey, so the recap is the
      // first moment they can be judged — and the right place to show them:
      // the visitor is already looking at everything they are about to send.
      if (schema) clearsConsistency(evaluatePlaybookConsistency(schema, answers));
      setReviewing(true);
      return;
    }
    setResumed(false);
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  }

  function goBack() {
    setResumed(false);
    if (reviewing) {
      setReviewing(false);
      return;
    }
    setStepIndex((i) => Math.max(0, i - 1));
  }

  /** Jump straight back to the step that holds a given answer, from the review. */
  function editStep(index: number) {
    setResumed(false);
    setReviewing(false);
    setError(null);
    setStepIndex(index);
  }

  async function analyzeInspirationPhoto(
    fieldKey: string,
    image: { base64: string; mediaType: string },
  ): Promise<InspirationPhotoAnalysis> {
    if (!sessionAuth) throw new Error(copy("Session not ready."));
    return callRuntime<InspirationPhotoAnalysis>({
      action: "analyze_inspiration_photo",
      session_id: sessionAuth.sessionId,
      session_secret: sessionAuth.secret,
      field_key: fieldKey,
      image_base64: image.base64,
      media_type: image.mediaType,
    });
  }

  async function uploadProjectPhoto(
    fieldKey: string,
    file: { base64: string; mediaType: string; filename: string },
  ) {
    if (!sessionAuth) throw new Error(copy("Session not ready."));
    return callRuntime<{
      storagePath: string;
      filename: string;
      sizeBytes: number;
      mimeType: string;
    }>({
      action: "upload_project_photo",
      session_id: sessionAuth.sessionId,
      session_secret: sessionAuth.secret,
      field_key: fieldKey,
      image_base64: file.base64,
      media_type: file.mediaType,
      filename: file.filename,
    });
  }

  async function submit() {
    if (!sessionAuth) return;
    // Last gate before the server sees it. The recap already showed these when
    // it opened; this catches an answer edited from the recap since.
    if (schema && !clearsConsistency(evaluatePlaybookConsistency(schema, answers))) {
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await callRuntime<{ dossier: DossierResult }>({
        action: "submit_session",
        session_id: sessionAuth.sessionId,
        session_secret: sessionAuth.secret,
        answers,
        locale,
      });
      setDossier(data.dossier);
    } catch {
      setError(copy("Unable to submit"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      className="intake-surface min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8"
      style={accentVariables}
    >
      {loading && (
        <div className="mx-auto max-w-5xl">
          <MissionRuntimeSkeleton label={copy("Preparing your project intake…")} />
          {slowLoad && (
            <p className="mt-4 text-center text-sm text-stone-500">
              {copy("This is taking longer than usual.")}
            </p>
          )}
        </div>
      )}

      {!loading && error && !mission && (
        <div className="mx-auto max-w-3xl rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{copy(error)}</p>
          <button
            type="button"
            onClick={retryLoad}
            className="mt-3 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
          >
            {copy("Try again")}
          </button>
        </div>
      )}

      {mission && dossier && (
        <VisitorProjectSummaryView
          summary={dossier.visitor_summary}
          emailSent={dossier.emailSent}
          summaryUrl={dossier.summaryUrl}
          onStartNew={startNewProject}
          followUp={renderAfterSubmission?.({ visitorEmail: visitorEmailFrom(answers) })}
        />
      )}

      {mission && schema && !dossier && (
        <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-start">
          <div className="min-w-0">
            <ProjectCanvasMobileSheet
              items={canvasItems}
              title={copy("Your project")}
              triggerLabel={`${copy("Your project")} · ${capturedCount} ${copy(capturedCount === 1 ? "detail captured" : "details captured")} ›`}
              description={copy("The project details captured so far.")}
              emptyText={copy("Your project will take shape as you answer.")}
            />
            <section className="intake-panel mt-4 border p-5 sm:p-6 lg:mt-0 lg:p-8">
              {/* The customer's accent, where they expect to see it: their own
                  name and their own progress. Never the page background — a dark
                  brand colour behind body text is unreadable, and we do not get
                  to test every colour a customer might pick. */}
              <p
                className="text-sm font-semibold uppercase tracking-[0.14em]"
                style={accent ? { color: accent } : undefined}
              >
                {copy(branding.displayName ?? mission.playbook_name ?? mission.name)}
              </p>
              {/* The welcome line, first step only. It sits above the step's own
                  title rather than replacing it: "Welcome to Denver Decks" is a
                  greeting, and the question the step actually asks still has to
                  be legible. */}
              {branding.introTitle && !reviewing && clampedStepIndex === 0 && (
                <p className="mt-4 text-lg font-medium text-stone-900">{branding.introTitle}</p>
              )}
              <h1 className="mt-3 max-w-3xl text-2xl font-semibold leading-tight tracking-normal text-stone-950 sm:text-4xl">
                {reviewing ? copy("Your project") : copy(currentStep?.step.title ?? mission.name)}
              </h1>
              {branding.introText && !reviewing && clampedStepIndex === 0 && (
                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
                  {branding.introText}
                </p>
              )}
              {mission.proposal?.intro && !branding.introText && !currentStep?.step.why && (
                <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
                  {copy(mission.proposal.intro)}
                </p>
              )}
              {currentStep?.step.why && !reviewing && (
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600 sm:mt-4 sm:text-lg">
                  {copy(currentStep.step.why)}
                </p>
              )}
              {visibleSteps.length > 0 && (
                <>
                  {/* Segments, not one bar: a visitor who wants to fix an
                      earlier answer had to press Back once per step, eight
                      times on an eleven-step Playbook. Only steps already
                      reached are clickable — jumping ahead would skip the
                      validation that gates each one. */}
                  <ol className="mt-6 flex gap-1" aria-label={copy("Steps")}>
                    {visibleSteps.map((step, index) => {
                      const reached = index <= clampedStepIndex || reviewing;
                      const current = !reviewing && index === clampedStepIndex;
                      return (
                        <li key={step.step.id} className="h-1.5 flex-1">
                          <button
                            type="button"
                            disabled={!reached}
                            aria-current={current ? "step" : undefined}
                            aria-label={`${copy(step.step.title)}${current ? ` — ${copy("current step")}` : ""}`}
                            onClick={() => editStep(index)}
                            className={`h-1.5 w-full rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)] focus-visible:ring-offset-2 ${
                              reached
                                ? "cursor-pointer bg-[color:var(--metre-accent)] hover:opacity-85"
                                : "cursor-default bg-stone-200"
                            }`}
                          />
                        </li>
                      );
                    })}
                  </ol>
                  {/* Position and time left, never a percentage: the total
                      moves as the visitor answers, so "13% complete" on the
                      first screen was a figure nobody could stand behind. The
                      label is words the dictionary owns, whole pieces at a
                      time — see progressLabel.ts. */}
                  <p className="mt-3 text-sm font-medium text-stone-600" aria-live="polite">
                    {reviewing
                      ? copy("Last look before sending")
                      : progress
                        ? formatProgress(progress, copy)
                        : null}
                  </p>
                </>
              )}
            </section>
            {/* What the deployment promises before the first question. Placed by
                the runtime, written by the route: see intakeGuidance.ts. */}
            {guidance?.intro && !reviewing && clampedStepIndex === 0 && (
              <div className="mt-4">{guidance.intro}</div>
            )}
            <section className="mt-4 rounded-lg border border-stone-300 bg-white p-5 shadow-sm sm:p-6 lg:p-8">
              {resumed && !reviewing && (
                <p
                  role="status"
                  className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                >
                  {copy("Welcome back — your answers are here, you pick up where you left off.")}
                </p>
              )}
              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                >
                  {copy(error)}
                </div>
              )}
              {consistencyErrors.length > 0 && (
                <div
                  ref={error ? undefined : errorRef}
                  role="alert"
                  className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                >
                  <p className="font-medium">{copy("These answers don't seem to work together")}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {consistencyErrors.map((notice) => (
                      <li key={notice.id}>{copy(notice.message)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {consistencyWarnings.length > 0 && (
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">{copy("Worth checking")}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {consistencyWarnings.map((notice) => (
                      <li key={notice.id}>{copy(notice.message)}</li>
                    ))}
                  </ul>
                  {/* A warning informs, it never decides — say plainly how to
                    keep the answer as it stands. */}
                  <p className="mt-3 text-xs text-amber-800">
                    {copy(
                      reviewing
                        ? "Select Send my project again to keep your answers as they are."
                        : "Select Continue again to keep your answers as they are.",
                    )}
                  </p>
                </div>
              )}
              {reviewing ? (
                <>
                  <ReviewAnswers
                    steps={visibleSteps}
                    answers={answers}
                    copy={copy}
                    onEdit={editStep}
                    previews={photoPreviews}
                    photoShots={guidance?.photoShots}
                  />
                  {guidance?.reviewNotice && <div className="mt-6">{guidance.reviewNotice}</div>}
                </>
              ) : currentStep ? (
                <>
                  <div className="grid gap-6">
                    {currentStep.visibleFields.map((field) => {
                      const FieldComponent = FIELD_COMPONENTS[field.type];
                      return (
                        <FieldComponent
                          key={field.key}
                          field={localizeField(field, copy)}
                          value={answers[field.key]}
                          onChange={(value) => setAnswer(field.key, value)}
                          error={fieldErrors[field.key]}
                          analyzeInspirationPhoto={(image) =>
                            analyzeInspirationPhoto(field.key, image)
                          }
                          uploadProjectPhoto={(file) => uploadProjectPhoto(field.key, file)}
                          photoShots={guidance?.photoShots?.[field.key]}
                          photoPreviews={photoPreviews}
                        />
                      );
                    })}
                  </div>
                  <StepGlossary
                    key={currentStep.step.id}
                    entries={glossaryEntries}
                    copy={copy}
                  />
                </>
              ) : (
                <p className="text-sm text-stone-600">
                  {copy("This mission has no questions yet.")}
                </p>
              )}
              {/* Sticky on a phone: a step with photos or a long choice grid
                  is several screens tall, and Continue used to sit at the
                  bottom of all of them. From `lg` up the page has room and
                  the bar is an ordinary row again. */}
              <div className="sticky bottom-0 z-10 -mx-5 mt-8 border-t border-stone-200 bg-white/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-t-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:pt-0 lg:backdrop-blur-none">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="min-h-11"
                    disabled={clampedStepIndex === 0 && !reviewing}
                    onClick={goBack}
                  >
                    {copy("Back")}
                  </Button>
                  {reviewing ? (
                    <Button
                      onClick={submit}
                      disabled={saving}
                      style={accentStyle}
                      className="min-h-11 flex-1 sm:flex-none"
                    >
                      {saving ? copy("Working…") : copy("Send my project")}
                      <FileText className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={goNext}
                      disabled={saving}
                      style={accentStyle}
                      className="min-h-11 flex-1 sm:flex-none"
                    >
                      {saving
                        ? copy("Working…")
                        : isLastStep
                          ? copy("Review my answers")
                          : copy("Continue")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500 sm:text-sm sm:leading-6">
                  {copy("Your answers are saved as you go — you can close this tab and come back.")}
                </p>
              </div>
            </section>
          </div>
          <ProjectCanvas
            title={copy("Your project")}
            eyebrow={copy("Project summary")}
            items={canvasItems}
            emptyText={copy("Your project will take shape as you answer.")}
            className="sticky top-6 hidden lg:block"
          />
        </section>
      )}
    </main>
  );
}

/**
 * The recap the marketing site has been promising: every answer the visitor
 * is about to send, grouped by the step it came from, each group with a way
 * straight back to it.
 *
 * Editing jumps to the step rather than opening the field inline, so there is
 * only ever one place a question is answered — the visitor sees the same
 * screen, the same help text and the same validation they saw the first time.
 *
 * Unanswered optional fields are listed as such instead of being hidden: on an
 * eleven-step intake, "you left this blank" is exactly what a recap is for.
 */
export function ReviewAnswers({
  steps,
  answers,
  copy,
  onEdit,
  previews,
  photoShots,
}: {
  steps: VisibleStep[];
  answers: Answers;
  copy: CopyFn;
  onEdit: (index: number) => void;
  previews: PhotoPreviewStore;
  photoShots?: Record<string, PhotoShot[]>;
}) {
  // Fields still blank, by step: the recap's job is to make "you left this
  // out" visible before sending, without ever blocking it — the required ones
  // were already enforced step by step.
  const blanks = steps.map((step) =>
    step.visibleFields.filter((field) => !formatAnswerForDisplay(field, answers[field.key] as AnswerValue)),
  );
  const blankCount = blanks.reduce((total, fields) => total + fields.length, 0);
  const firstBlankStep = blanks.findIndex((fields) => fields.length > 0);

  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-base leading-7 text-stone-600">
        {copy("Nothing has been sent yet. Change anything that is not right.")}
      </p>
      {blankCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            {blankCount}{" "}
            {copy(blankCount === 1 ? "question left unanswered" : "questions left unanswered")}
          </p>
          <p className="mt-1 leading-6">
            {copy("You can still send your project — every detail you add helps.")}
          </p>
          <button
            type="button"
            onClick={() => onEdit(firstBlankStep)}
            className="mt-3 inline-flex min-h-11 items-center rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)]"
          >
            {copy("Go to the first one")}
          </button>
        </div>
      )}
      {steps.map((step, index) => (
        <section key={step.step.id} className="border-t border-stone-300 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-normal text-stone-950">
              {copy(step.step.title)}
            </h2>
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:border-[color:var(--metre-accent)] hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--metre-accent)]"
            >
              {copy("Edit")}
            </button>
          </div>
          <dl className="mt-4 grid gap-3">
            {step.visibleFields.map((field) => {
              const value = answers[field.key] as AnswerValue;
              const text = formatAnswerForDisplay(field, value);
              // The engine words "not sure" and a ticked consent ("Yes") in
              // English on purpose (they feed the internal Brief); the visitor
              // reads them here, so they go through the dictionary — and only
              // these cases do, never free text a visitor typed.
              const shown =
                value === NOT_SURE_VALUE
                  ? copy("Not sure")
                  : typeof value === "boolean"
                    ? copy(text)
                    : text;
              const photos =
                field.type === "photo" && Array.isArray(value) ? (value as PhotoAnswerEntry[]) : [];
              return (
                <div key={field.key} className="grid gap-1 sm:grid-cols-[220px_1fr] sm:gap-4">
                  <dt className="text-sm font-medium text-stone-500">{copy(field.label)}</dt>
                  <dd
                    className={
                      shown ? "text-base text-stone-950" : "text-base italic text-stone-400"
                    }
                  >
                    {photos.length > 0 ? (
                      <ul className="flex flex-wrap gap-3">
                        {photos.map((photo, photoIndex) => {
                          const view = photoShots?.[field.key]?.find((s) => s.key === photo.shot);
                          return (
                            <li key={photo.storagePath ?? `${photo.filename}-${photoIndex}`} className="w-20">
                              <span className="block aspect-square overflow-hidden rounded-md border border-stone-200 bg-stone-100">
                                <PhotoThumb
                                  photo={photo}
                                  previews={previews}
                                  savedLabel={copy("Photo saved")}
                                />
                              </span>
                              <span className="mt-1 block truncate text-xs text-stone-600">
                                {view?.label ?? photo.filename}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      shown || copy("Not answered")
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

/** Every piece of visitor-facing text a step carries, for the glossary to read. */
function stepTexts(step: VisibleStep): string[] {
  const texts: string[] = [step.step.title, step.step.why ?? ""];
  for (const field of step.visibleFields) {
    texts.push(field.label, field.helpText ?? "");
    const options = (field as { options?: unknown }).options;
    if (Array.isArray(options)) {
      for (const option of options) {
        if (typeof option === "string") texts.push(option);
        else if (option && typeof option === "object") {
          const { label, reassurance } = option as { label?: unknown; reassurance?: unknown };
          if (typeof label === "string") texts.push(label);
          if (typeof reassurance === "string") texts.push(reassurance);
        }
      }
    }
  }
  return texts;
}
