/** Le cadre de travail du relieur : une navigation stable autour des gestes quotidiens. */
import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, FileText, Globe2, House, Inbox, LibraryBig, Menu, MessageSquare, ReceiptText, Users } from "lucide-react";
import { SignOutButton } from "@/marketplace/pages/SignOutButton";
import { getMyBinderProfile, listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { FineBinderyWorkspaceProvider, PROFESSIONAL_COPY, useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { FINE_BINDERY_LOCALES, type FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";
import { languageName } from "@/marketplace/i18n/fineBinderyGlossary";

export const Route = createFileRoute("/_authenticated/atelier")({ ssr: false, component: AtelierLayout });

const PRIMARY_NAV = [
  { to: "/atelier", key: "today", icon: House, exact: true },
  { to: "/atelier/leads", key: "projects", icon: Inbox, exact: false },
  { to: "/atelier/messages", key: "messages", icon: MessageSquare, exact: false },
  { to: "/atelier/devis", key: "quotes", icon: FileText, exact: false },
] as const;
const SECONDARY_NAV = [
  { to: "/atelier/ouvrages", key: "books", icon: BookOpen },
  { to: "/atelier/contacts", key: "contacts", icon: Users },
  { to: "/atelier/factures", key: "invoices", icon: ReceiptText },
  { to: "/atelier/tarifs", key: "settings", icon: LibraryBig },
  { to: "/atelier/profil-public", key: "profile", icon: Globe2 },
] as const;

function Count({ value }: { value: number }) {
  if (value < 1) return null;
  return <span className="ml-auto min-w-5 rounded-full bg-[#7a2230] px-1.5 py-0.5 text-center text-[0.65rem] font-bold leading-4 text-white">{value}</span>;
}

function WorkspaceLanguageSelect({ locale, label, onChange, compact = false }: { locale: FineBinderyLocale; label: string; onChange: (locale: FineBinderyLocale) => void; compact?: boolean }) {
  return (
    <label className={compact ? "flex min-h-11 items-center justify-between gap-3 px-3 text-sm" : "block px-3 py-3"}>
      <span className={compact ? "font-medium" : "mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#8b8175]"}>{label}</span>
      <select value={locale} onChange={(event) => onChange(event.target.value as FineBinderyLocale)} className="min-h-10 rounded-sm border border-[#cfc5b6] bg-[#fffdf8] px-2 text-sm text-[#241a12]">
        {FINE_BINDERY_LOCALES.map((option) => <option key={option} value={option}>{languageName(option, option)}</option>)}
      </select>
    </label>
  );
}

function AtelierLayout() { return <FineBinderyWorkspaceProvider><AtelierLayoutContent /></FineBinderyWorkspaceProvider>; }

function AtelierLayoutContent() {
  const { isFineBindery, locale, setLocale } = useFineBinderyWorkspace();
  const copy = PROFESSIONAL_COPY[locale];
  const fetchCases = useServerFn(listMyBinderCases);
  const fetchProfile = useServerFn(getMyBinderProfile);
  const cases = useQuery({ queryKey: ["marketplace", "binder", "cases"], queryFn: () => fetchCases(), retry: false });
  const profile = useQuery({ queryKey: ["marketplace", "binder", "profile"], queryFn: () => fetchProfile(), retry: false });
  const newCount = (cases.data ?? []).filter((row) => row.state === "offered" || row.state === "invited").length;
  const unreadCount = (cases.data ?? []).reduce((total, row) => total + row.unreadCount, 0);
  const badgeFor = (key: string) => key === "projects" ? newCount : key === "messages" ? unreadCount : 0;

  return (
    <div className="min-h-screen bg-[#f4efe6] text-[#241a12] lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a href="#atelier-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:bg-[#241a12] focus:px-4 focus:py-3 focus:text-white">{copy.skipToContent}</a>
      <aside className="hidden min-h-screen border-r border-[#d8d0c4] bg-[#fbf8f2] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-[#d8d0c4] px-6 py-7">
          <Link to="/atelier" className="block font-editorial text-2xl leading-none tracking-[-0.02em]">{isFineBindery ? "FineBindery" : "Ma Reliure"}</Link>
          <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#7a2230]">{copy.space}</p>
        </div>
        <nav aria-label={copy.workspaceNavigation} className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#8b8175]">{copy.work}</p>
          <div className="space-y-1">
            {PRIMARY_NAV.map((item) => { const Icon = item.icon; return (
              <Link key={item.to} to={item.to} activeOptions={item.exact ? { exact: true } : undefined} className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium text-[#5d5146] transition hover:bg-[#eee7dc] hover:text-[#241a12]" activeProps={{ className: "bg-[#e9e0d3] text-[#241a12] shadow-[inset_3px_0_0_#7a2230]" }}>
                <Icon aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" /><span>{copy[item.key]}</span><Count value={badgeFor(item.key)} />
              </Link>
            ); })}
          </div>
          <p className="mt-7 px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#8b8175]">{copy.workshop}</p>
          <div className="space-y-1">
            {SECONDARY_NAV.map((item) => { const Icon = item.icon; return (
              <Link key={item.to} to={item.to} className="flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm font-medium text-[#5d5146] transition hover:bg-[#eee7dc] hover:text-[#241a12]" activeProps={{ className: "bg-[#e9e0d3] text-[#241a12] shadow-[inset_3px_0_0_#7a2230]" }}>
                <Icon aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" />{copy[item.key]}
              </Link>
            ); })}
          </div>
        </nav>
        {isFineBindery && <WorkspaceLanguageSelect locale={locale} label={copy.language} onChange={setLocale} />}
        <div className="border-t border-[#d8d0c4] px-4 py-3"><SignOutButton label={copy.signOut} signedInAs={copy.signedIn} className="inline-flex min-h-11 items-center text-xs font-medium text-[#685d51] underline-offset-4 hover:underline" /></div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b border-[#d8d0c4] bg-[#fbf8f2]/95 px-4 backdrop-blur lg:hidden">
          <div><Link to="/atelier" className="font-editorial text-xl leading-none">{isFineBindery ? "FineBindery" : "Ma Reliure"}</Link><p className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-[#7a2230]">{copy.space}</p></div>
          <SignOutButton label={copy.signOut} signedInAs={copy.signedIn} className="inline-flex min-h-11 items-center px-2 text-xs font-semibold underline-offset-4 hover:underline" />
        </header>
        <main id="atelier-main" className="mx-auto min-h-[calc(100vh-4rem)] max-w-[76rem] px-4 py-7 pb-28 sm:px-6 sm:py-10 lg:px-10 lg:pb-14 xl:px-14">
          {profile.data && profile.data.status !== "approved" && (
            <div role="status" className="mb-7 border-l-4 border-amber-700 bg-amber-50 px-5 py-4 text-sm text-amber-950"><strong className="block">{copy.pending}</strong><p className="mt-1 leading-6">{copy.pendingBody}</p></div>
          )}
          <Outlet />
        </main>
      </div>

      <nav aria-label={copy.mobileNavigation} className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#cfc5b6] bg-[#fffdf8]/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden">
        {PRIMARY_NAV.map((item) => { const Icon = item.icon; return (
          <Link key={item.to} to={item.to} activeOptions={item.exact ? { exact: true } : undefined} className="relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-sm text-[0.65rem] font-medium text-[#74695d]" activeProps={{ className: "bg-[#f0e9df] text-[#5f1b27]" }}>
            <Icon aria-hidden="true" className="h-[1.1rem] w-[1.1rem]" />{copy[item.key]}{badgeFor(item.key) > 0 && <span className="absolute right-[23%] top-1.5 h-2 w-2 rounded-full bg-[#7a2230]" />}
          </Link>
        ); })}
        <details className="group relative">
          <summary className="flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-sm text-[0.65rem] font-medium text-[#74695d] [&::-webkit-details-marker]:hidden"><Menu aria-hidden="true" className="h-[1.1rem] w-[1.1rem]" />{copy.more}</summary>
          <div className="absolute bottom-[calc(100%+0.5rem)] right-1 w-52 border border-[#cfc5b6] bg-[#fffdf8] p-2 shadow-xl">
            {SECONDARY_NAV.map((item) => { const Icon = item.icon; return <Link key={item.to} to={item.to} className="flex min-h-11 items-center gap-3 px-3 text-sm hover:bg-[#f0e9df]"><Icon aria-hidden="true" className="h-4 w-4" />{copy[item.key]}</Link>; })}
            {isFineBindery && <WorkspaceLanguageSelect compact locale={locale} label={copy.language} onChange={setLocale} />}
          </div>
        </details>
      </nav>
    </div>
  );
}
