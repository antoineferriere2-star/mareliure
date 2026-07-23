import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { label: "Deck builders", href: "/deck-builders" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Example brief", href: "/example-project-brief" },
  { label: "Free audit", href: "/free-inquiry-audit" },
];

// NOTE: Only "/" is a real TanStack route today. Other Build public routes
// come in step 2. Use plain <a href> for now so typechecking doesn't require
// declared routes that don't exist yet.

export function BuildPublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold tracking-normal text-slate-950">
            <img src="/metre-icon.svg" alt="Métré Build" className="h-8 w-8" />
            <span>Métré Build</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-slate-950">
                {item.label}
              </a>
            ))}
          </nav>
          <a href="/demo/deck-project">
            <Button size="sm">Try demo</Button>
          </a>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_2fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3 font-semibold">
              <img src="/metre-icon.svg" alt="" className="h-8 w-8" />
              Métré Build
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              Private beta for US project-based businesses. Built to turn incomplete website inquiries into structured project briefs.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
            <FooterLinks title="Product" links={[navItems[0], navItems[1], { label: "Demo", href: "/demo/deck-project" }]} />
            <FooterLinks title="Conversion" links={[{ label: "Example brief", href: "/example-project-brief" }, { label: "Free audit", href: "/free-inquiry-audit" }, { label: "Private beta", href: "/private-beta" }]} />
            <FooterLinks title="Legal" links={[{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }]} />
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterLinks({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">{title}</h2>
      <div className="mt-3 space-y-2">
        {links.map((link) => (
          <a key={link.href} href={link.href} className="block hover:text-white">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-7 text-slate-600">{description}</p>}
    </div>
  );
}

export function PublicCtaBand() {
  return (
    <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">Private beta</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal">See what a better project inquiry looks like.</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href="/demo/deck-project"><Button>Try the demo</Button></a>
          <a href="/free-inquiry-audit">
            <Button variant="outline" className="border-white bg-transparent text-white hover:bg-white hover:text-slate-950">
              Request a free audit
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

export function CheckItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 text-sm leading-6 text-slate-700">
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
      {children}
    </div>
  );
}

export function InfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map((item) => <CheckItem key={item}>{item}</CheckItem>)}
      </div>
    </section>
  );
}

export function ObjectCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <Icon className="h-6 w-6 text-emerald-700" />
      <h3 className="mt-4 text-lg font-semibold tracking-normal">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </section>
  );
}

export function StepLine({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800">{index}</span>
      <h3 className="mt-4 font-semibold tracking-normal text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </section>
  );
}

export function ComparisonRow({ classic, build }: { classic: string; build: string }) {
  return (
    <div className="grid border-b border-slate-200 last:border-b-0 md:grid-cols-2">
      <div className="p-4 text-sm text-slate-600">{classic}</div>
      <div className="border-t border-slate-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950 md:border-l md:border-t-0">{build}</div>
    </div>
  );
}
