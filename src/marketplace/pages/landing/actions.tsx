/**
 * Les trois actions des sites publics — et il n'y en a que trois.
 *
 * Primaire : l'aplat sombre, une seule fois par écran autant que possible.
 * Secondaire : le contour, pour l'alternative qui mérite un bouton.
 * Lien : discret, souligné, pour tout le reste.
 *
 * Ma Reliure et FineBindery partagent ces classes ; leur personnalité vient des
 * jetons `mr-*` que chaque site redéfinit (`.fb-site` dans styles.css), pas
 * d'une seconde famille de boutons. Il en existait sept variantes, dont un
 * survol vers une couleur `mr-walnut` qui n'a jamais existé.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

export type ActionVariant = "primary" | "secondary" | "text";
export type ActionSize = "default" | "compact";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[2px] text-center font-semibold tracking-[0.01em] transition-colors duration-200";

const SIZES: Record<ActionSize, string> = {
  default: "px-7 py-3.5 text-[0.9375rem]",
  compact: "px-4 py-2.5 text-[0.8125rem] sm:px-5",
};

const SKINS: Record<Exclude<ActionVariant, "text">, string> = {
  primary: "bg-mr-ink text-mr-paper hover:bg-mr-graphite",
  secondary: "border border-mr-ink/30 text-mr-ink hover:border-mr-ink hover:bg-mr-ink/[0.04]",
};

/** Sur fond d'encre, les deux boutons s'inversent : papier plein, ou contour papier. */
const SKINS_ON_INK: Record<Exclude<ActionVariant, "text">, string> = {
  primary: "bg-mr-paper text-mr-ink hover:bg-mr-paper-warm",
  secondary: "border border-mr-paper/40 text-mr-paper hover:border-mr-paper hover:bg-mr-paper/[0.06]",
};

export function actionClass(variant: ActionVariant, size: ActionSize = "default", onInk = false): string {
  if (variant === "text") return "mr-link mr-tap text-[1.0625rem]";
  return `${BASE} ${SIZES[size]} ${(onInk ? SKINS_ON_INK : SKINS)[variant]}`;
}

export function ActionLink({
  variant = "primary",
  size = "default",
  onInk = false,
  className = "",
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ActionVariant; size?: ActionSize; onInk?: boolean; children: ReactNode }) {
  return (
    <a {...props} className={`${actionClass(variant, size, onInk)} ${className}`.trim()}>
      {children}
    </a>
  );
}
