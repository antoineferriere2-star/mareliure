/**
 * Every string the Guided Project Intake itself can put in front of a visitor:
 * the runtime's own chrome, the Project Canvas, the field components, and the
 * Project Summary they see afterwards.
 *
 * It exists so a locale's coverage of *that* surface can be asserted rather
 * than assumed. A Playbook's own words are data and are already written in the
 * Mission's language; these are the words the engine supplies, and a Mission
 * running in French with an English "Continue" button is a broken experience
 * nobody notices until a real visitor meets it.
 *
 * Marketing pages are deliberately out of scope: no marketing surface selects
 * a locale this list is used to check.
 *
 * When a component adds a `copy("…")` string, it goes here, and
 * `runtimeChrome.test.ts` fails until every locale that claims to cover the
 * runtime has translated it.
 */

/** Navigation, status and framing supplied by MissionRuntime itself. */
export const RUNTIME_CHROME_STRINGS: readonly string[] = [
  // Loading and failure
  "Preparing your project intake…",
  "This is taking longer than usual.",
  "Try again",
  "Loading…",
  "Working…",
  "This mission has no questions yet.",
  "This summary link is not available.",
  // Navigation
  "Back",
  "Continue",
  "Steps",
  "current step",
  "complete",
  "Review my answers",
  "Send my project",
  "Last look before sending",
  "Nothing has been sent yet. Change anything that is not right.",
  "Your answers are saved as you go — you can close this tab and come back.",
  "Please check the following before continuing:",
  // The Vérificateur
  "These answers don't seem to work together",
  "Worth checking",
  // Project Canvas
  "Your project",
  "Project canvas",
  "Live project canvas",
  "The project details Métré has captured so far.",
  "Your project will take shape as you answer.",
  "detail captured",
  "details captured",
  "Project",
  "Derived",
  "Budget & timing",
  "To clarify",
  "Confirmed",
  "Not answered",
  "Captured",
  // Fields
  "Add photos that help the team understand the site before the first call.",
  "Choose photos or use your camera",
  "Photo limit reached",
  "slot",
  "slots",
  "available",
  "Maximum of",
  "reached. Remove one to add another.",
  "Uploading…",
  "photo attached",
  "photos attached",
  "I'm not sure yet",
  "Marked to clarify",
  "Edit",
  // Inspiration photo
  "Choose an inspiration image",
  "Looking at your inspiration…",
  "Here's what we noticed — review and confirm",
  "Métré will suggest what it notices, then you confirm or adjust it.",
  "Image notes captured",
  "Style",
  "Materials",
  "Shape",
  "Elements",
  "Detected from the provided information",
  "Not detected — add details if needed",
  // Project Summary
  "Project sent",
  "Project summary",
  "Your project summary is ready",
  "Your information has been sent to",
  "Review your summary",
  "Still to confirm",
  "What happens next",
  "The team will review your project information and contact you to discuss the next step.",
  "We sent a copy of this summary to your email.",
  "No details were provided yet.",
  "Topics to review with the sales team:",
  "The visual preview couldn't be shown.",
];

/**
 * Validation messages, as templates.
 *
 * `localizeValidationMessage` in MissionRuntime.tsx masks the field label and
 * any numbers out before translating, so these are the exact strings the
 * dictionary is asked for. They come from `engine/validation.ts`, which is
 * English by design — the engine's messages are internal, and this is where
 * they become a visitor's language.
 */
export const RUNTIME_VALIDATION_TEMPLATES: readonly string[] = [
  '"{field}" is required.',
  '"{field}" requires a specific answer.',
  '"{field}" has an invalid option.',
  '"{field}" must be a list.',
  '"{field}" requires at least {n0} selection(s).',
  '"{field}" allows at most {n0} selection(s).',
  '"{field}" must be text.',
  '"{field}" is too short.',
  '"{field}" is too long.',
  '"{field}" is not valid.',
  '"{field}" must be a number.',
  '"{field}" is below the minimum.',
  '"{field}" is above the maximum.',
  '"{field}" has an invalid range.',
  '"{field}" is invalid.',
  '"{field}" requires at least one value.',
  '"{field}" must be a list of photos.',
  '"{field}" allows at most {n0} photo(s).',
  '"{field}" has an unsupported photo.',
  '"{field}" must be accepted.',
];

/** Errors the runtime API returns and the runtime shows verbatim. */
export const RUNTIME_API_ERRORS: readonly string[] = [
  "Some required information is missing or invalid.",
  "Some answers contradict each other.",
  "Mission not found or not published",
  "Mission not available",
  "Session not found",
  "Session already submitted",
  "Runtime error",
  "Too many requests. Please try again later.",
];

export const ALL_RUNTIME_STRINGS: readonly string[] = [
  ...RUNTIME_CHROME_STRINGS,
  ...RUNTIME_VALIDATION_TEMPLATES,
  ...RUNTIME_API_ERRORS,
];
