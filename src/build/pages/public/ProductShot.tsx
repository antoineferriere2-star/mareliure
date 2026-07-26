import type { ReactNode } from "react";

/**
 * Shared visual frame for every "real product" marketing shot. Title and
 * description are plain HTML text (never baked into an image) so search
 * engines and screen readers see the same content as sighted visitors.
 */
export function ProductShot({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="max-w-2xl">
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">{title}</h3>
        {description && <p className="mt-2 text-[15px] leading-6 text-slate-700">{description}</p>}
      </figcaption>
      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        {children}
      </div>
    </figure>
  );
}
