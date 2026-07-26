import { useState } from "react";
import { SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { InspirationPhotoField } from "@/build/engine/fields/InspirationPhotoField";
import { demoInspirationPhotoField, demoInspirationAnswer } from "@/build/content/demoProductData";
import type { AnswerValue } from "@/build/schema/answers";

/**
 * Simple schematic illustration standing in for an inspiration photo — never
 * a fabricated "customer photo", to avoid any ambiguity about its origin.
 * Inline SVG: no extra network request, crisp at any size.
 */
function InspirationIllustration() {
  return (
    <svg
      viewBox="0 0 400 300"
      role="img"
      aria-label="Schematic illustration of a backyard deck with railing and stairs"
      className="w-full min-w-0 rounded-md border border-slate-200 bg-slate-50"
    >
      <rect x="0" y="0" width="400" height="300" fill="#f8fafc" />
      <rect
        x="20"
        y="190"
        width="360"
        height="90"
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="2"
      />
      {Array.from({ length: 17 }).map((_, i) => (
        <line
          key={i}
          x1={30 + i * 21}
          y1="190"
          x2={30 + i * 21}
          y2="280"
          stroke="#cbd5e1"
          strokeWidth="2"
        />
      ))}
      <line x1="20" y1="190" x2="20" y2="130" stroke="#64748b" strokeWidth="4" />
      <line x1="20" y1="130" x2="380" y2="130" stroke="#64748b" strokeWidth="4" />
      <line x1="380" y1="130" x2="380" y2="190" stroke="#64748b" strokeWidth="4" />
      {[60, 140, 220, 300, 360].map((x) => (
        <line key={x} x1={x} y1="130" x2={x} y2="190" stroke="#94a3b8" strokeWidth="3" />
      ))}
      <rect
        x="150"
        y="240"
        width="60"
        height="40"
        fill="#cbd5e1"
        stroke="#94a3b8"
        strokeWidth="2"
      />
      <text x="200" y="30" textAnchor="middle" fontSize="14" fill="#64748b" fontFamily="sans-serif">
        Schematic — not an actual photo
      </text>
    </svg>
  );
}

/** Bare illustration + field, no heading/section wrapper — for embedding compactly inside another section. */
export function InspirationPreview() {
  const [answer, setAnswer] = useState<AnswerValue>(demoInspirationAnswer);
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:items-start">
      <div className="min-w-0">
        <InspirationIllustration />
      </div>
      <div className="min-w-0">
        <InspirationPhotoField
          field={demoInspirationPhotoField}
          value={answer}
          onChange={setAnswer}
        />
      </div>
    </div>
  );
}

export function InspirationSection() {
  return (
    <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Start from a photo"
          title="Customers who don't have the words can start from a picture instead."
          description="An inspiration photo — their own yard, a screenshot, a catalog picture — is analyzed and turned into hypotheses the visitor confirms or corrects. Nothing is presented as fact until they say so."
        />
        <div className="mt-8">
          <InspirationPreview />
        </div>
      </div>
    </section>
  );
}
