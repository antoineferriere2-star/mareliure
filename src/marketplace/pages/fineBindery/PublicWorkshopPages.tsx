import { useMemo, useState } from "react";
import { FINE_BINDERY_PUBLIC_TOKEN } from "@/build/constants";
import {
  PROFILE_REQUEST_SOURCE,
  PUBLIC_LANGUAGES,
  PUBLIC_MATERIALS,
  PUBLIC_TECHNIQUES,
} from "@/marketplace/binders/fineBinderyProfile";
import { FineBinderyFooter } from "./FineBinderyChrome";

type DirectoryProfile = {
  slug: string;
  path: string;
  workshopName: string;
  professionalName: string;
  city: string;
  countryCode: string;
  bio: string;
  languages: string[];
  skills: { slug: string; label: string; labelEn: string }[];
  imageUrl: string | null;
};

type PublicProfile = Awaited<ReturnType<typeof import("@/marketplace/services/fineBinderyProfile.data.functions").getPublicFineBinderyProfile>>;

const SHELL = "mx-auto w-full max-w-[78rem] px-5 sm:px-8 lg:px-12";
const languageLabel = new Map<string, string>(PUBLIC_LANGUAGES.map((item) => [item.code, item.label]));
const techniqueLabel = new Map<string, string>(PUBLIC_TECHNIQUES.map((item) => [item.key, item.label]));
const materialLabel = new Map<string, string>(PUBLIC_MATERIALS.map((item) => [item.key, item.label]));

function PublicHeader() {
  return (
    <header className="border-b border-[#d9d1c4] bg-[#f7f3eb]">
      <div className={`${SHELL} flex min-h-20 items-center justify-between gap-5`}>
        <a href="/" className="font-editorial text-2xl tracking-[-0.025em] text-[#17231c]">FineBindery</a>
        <nav aria-label="FineBindery" className="flex items-center gap-5 text-sm text-[#455047]">
          <a href="/professionnels" className="min-h-11 content-center underline-offset-4 hover:underline">Professionnels</a>
          <a href="/" className="hidden min-h-11 content-center underline-offset-4 hover:underline sm:block">Le réseau</a>
        </nav>
      </div>
    </header>
  );
}

function profileRequestHref(slug: string) {
  const params = new URLSearchParams({ ref: slug, source: PROFILE_REQUEST_SOURCE });
  return `/m/${FINE_BINDERY_PUBLIC_TOKEN}?${params.toString()}`;
}

export function FineBinderyDirectoryPage({ profiles }: { profiles: DirectoryProfile[] }) {
  const [specialty, setSpecialty] = useState("");
  const [language, setLanguage] = useState("");
  const filtered = useMemo(() => profiles.filter((profile) =>
    (!specialty || profile.skills.some((skill) => skill.slug === specialty))
    && (!language || profile.languages.includes(language)),
  ), [profiles, specialty, language]);
  const specialties = useMemo(() => {
    const entries = new Map<string, string>();
    profiles.flatMap((profile) => profile.skills).forEach((skill) => entries.set(skill.slug, skill.label));
    return [...entries].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [profiles]);

  return (
    <div className="mr-site flex min-h-screen flex-col bg-[#f7f3eb] text-[#243128]">
      <PublicHeader />
      <main className="flex-1">
        <section className={`${SHELL} py-14 sm:py-20`}>
          <p className="mr-eyebrow text-[#8a6235]">FineBindery Network · France</p>
          <h1 className="mr-title mt-5 max-w-3xl text-4xl leading-tight text-[#17231c] sm:text-6xl">Des ateliers choisis pour leur geste, leur parcours et leur regard.</h1>
          <p className="mr-lead mt-6 max-w-2xl">Découvrez des relieurs et restaurateurs indépendants. Chaque demande présentée depuis une page professionnelle arrive directement dans l’atelier concerné.</p>
        </section>

        <section className="border-y border-[#d9d1c4] bg-[#efe9de]">
          <div className={`${SHELL} grid gap-4 py-5 sm:grid-cols-2`}>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e675f]">Spécialité
              <select className="mt-2 min-h-11 w-full border border-[#c9beae] bg-[#fffdf8] px-3 text-sm normal-case tracking-normal" value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
                <option value="">Toutes les spécialités</option>
                {specialties.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5e675f]">Langue
              <select className="mt-2 min-h-11 w-full border border-[#c9beae] bg-[#fffdf8] px-3 text-sm normal-case tracking-normal" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="">Toutes les langues</option>
                {PUBLIC_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className={`${SHELL} py-12 sm:py-16`}>
          {filtered.length === 0 ? <p className="border-y border-[#d9d1c4] py-10 text-center text-[#5e675f]">Aucun atelier publié ne correspond à ces critères.</p> : (
            <ul className="grid gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((profile) => <li key={profile.slug}>
                <a href={profile.path} className="group block">
                  {profile.imageUrl ? <img src={profile.imageUrl} alt={`Atelier ${profile.workshopName}`} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-[#dfe2d8] font-editorial text-5xl text-[#36513e]">{profile.workshopName.slice(0, 1)}</div>}
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6235]">{profile.city}, France</p>
                  <h2 className="mt-2 font-editorial text-2xl text-[#17231c] group-hover:underline">{profile.workshopName}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#59635b]">{profile.bio}</p>
                  <p className="mt-4 text-sm text-[#36513e]">{profile.skills.slice(0, 4).map((skill) => skill.label).join(" · ")}</p>
                </a>
              </li>)}
            </ul>
          )}
        </section>
      </main>
      <FineBinderyFooter />
    </div>
  );
}

export function FineBinderyWorkshopPage({ profile }: { profile: NonNullable<PublicProfile> }) {
  const techniques = profile.techniqueKeys.map((key) => techniqueLabel.get(key)).filter(Boolean);
  const materials = profile.materialKeys.map((key) => materialLabel.get(key)).filter(Boolean);
  return (
    <div className="mr-site flex min-h-screen flex-col bg-[#f7f3eb] text-[#243128]">
      <PublicHeader />
      <main className="flex-1">
        <section className={`${SHELL} grid gap-10 py-12 sm:py-20 lg:grid-cols-12 lg:items-center`}>
          <div className="lg:col-span-6">
            <p className="mr-eyebrow text-[#8a6235]">Atelier FineBindery · {profile.city}, France</p>
            <h1 className="mr-title mt-5 text-5xl leading-[0.98] text-[#17231c] sm:text-7xl">{profile.workshopName}</h1>
            <p className="mt-5 text-lg text-[#59635b]">{profile.professionalName}</p>
            <p className="mr-lead mt-7 max-w-xl">{profile.bio}</p>
            <a href={profileRequestHref(profile.slug)} className="mt-9 inline-flex min-h-12 items-center bg-[#263d2e] px-6 text-sm font-semibold text-white transition hover:bg-[#17231c]">Présenter mon projet</a>
          </div>
          <div className="lg:col-span-6">
            {profile.workshopPhotoUrl ? <img src={profile.workshopPhotoUrl} alt={`L’atelier ${profile.workshopName}`} className="aspect-[4/3] w-full object-cover" /> : profile.logoUrl ? <div className="flex aspect-[4/3] items-center justify-center bg-[#e5dfd3]"><img src={profile.logoUrl} alt={`Logo ${profile.workshopName}`} className="max-h-40 max-w-[70%] object-contain" /></div> : <div className="flex aspect-[4/3] items-center justify-center bg-[#dfe2d8] font-editorial text-7xl text-[#36513e]">{profile.workshopName.slice(0, 1)}</div>}
          </div>
        </section>

        <section className="border-y border-[#d9d1c4] bg-[#efe9de]">
          <div className={`${SHELL} grid gap-8 py-10 sm:grid-cols-3`}>
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6235]">Spécialités</p><p className="mt-3 leading-7">{profile.skills.map((skill) => skill.label).join(" · ")}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6235]">Langues</p><p className="mt-3 leading-7">{profile.languages.map((code) => languageLabel.get(code) ?? code.toUpperCase()).join(" · ")}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6235]">Techniques & matières</p><p className="mt-3 leading-7">{[...techniques, ...materials].join(" · ") || "Selon le projet"}</p></div>
          </div>
        </section>

        {(profile.training || profile.philosophy) && <section className={`${SHELL} grid gap-10 py-14 sm:py-20 lg:grid-cols-2`}>
          {profile.training && <div><p className="mr-eyebrow text-[#8a6235]">Parcours</p><p className="mt-5 whitespace-pre-line leading-7 text-[#4f5a51]">{profile.training}</p></div>}
          {profile.philosophy && <div><p className="mr-eyebrow text-[#8a6235]">Approche</p><p className="mt-5 whitespace-pre-line leading-7 text-[#4f5a51]">{profile.philosophy}</p></div>}
        </section>}

        {profile.portfolio.length > 0 && <section className="bg-[#17231c] text-[#f7f3eb]">
          <div className={`${SHELL} py-14 sm:py-20`}>
            <p className="mr-eyebrow text-[#c9a979]">Réalisations</p>
            <h2 className="mr-title mt-4 text-4xl sm:text-5xl">Le travail de l’atelier.</h2>
            <div className="mt-10 grid gap-10 sm:grid-cols-2">
              {profile.portfolio.map((item) => <article key={item.id}>
                <div className={`grid gap-1 ${item.beforePhotoUrl && item.afterPhotoUrl ? "grid-cols-2" : "grid-cols-1"}`}>
                  {item.beforePhotoUrl && <figure><img src={item.beforePhotoUrl} alt={`${item.title}, avant intervention`} className="aspect-[4/3] w-full object-cover" /><figcaption className="mt-2 text-xs uppercase tracking-[0.12em] text-[#c9c4b8]">Avant</figcaption></figure>}
                  {item.afterPhotoUrl && <figure><img src={item.afterPhotoUrl} alt={`${item.title}, après intervention`} className="aspect-[4/3] w-full object-cover" /><figcaption className="mt-2 text-xs uppercase tracking-[0.12em] text-[#c9c4b8]">Après</figcaption></figure>}
                </div>
                <h3 className="mt-5 font-editorial text-2xl">{item.title}{item.year ? ` · ${item.year}` : ""}</h3>
                {item.description && <p className="mt-3 leading-7 text-[#d9d5cc]">{item.description}</p>}
              </article>)}
            </div>
          </div>
        </section>}

        <section className={`${SHELL} py-14 text-center sm:py-20`}>
          <p className="mr-eyebrow text-[#8a6235]">Un livre, un échange, un geste juste</p>
          <h2 className="mr-title mx-auto mt-4 max-w-2xl text-4xl text-[#17231c] sm:text-5xl">Parlez directement de votre projet à {profile.workshopName}.</h2>
          <a href={profileRequestHref(profile.slug)} className="mt-8 inline-flex min-h-12 items-center bg-[#263d2e] px-6 text-sm font-semibold text-white">Présenter mon projet</a>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-[#59635b]">
            {profile.websiteUrl && <a href={profile.websiteUrl} rel="noreferrer" className="underline underline-offset-4">Site de l’atelier</a>}
            {profile.instagramUrl && <a href={profile.instagramUrl} rel="noreferrer" className="underline underline-offset-4">Instagram</a>}
            {profile.professionalPhone && <a href={`tel:${profile.professionalPhone}`} className="underline underline-offset-4">Téléphoner à l’atelier</a>}
            {profile.professionalEmail && <a href={`mailto:${profile.professionalEmail}`} className="underline underline-offset-4">Écrire à l’atelier</a>}
          </div>
        </section>
      </main>
      <FineBinderyFooter />
    </div>
  );
}

export function FineBinderyWorkshopNotFound() {
  return <div className="mr-site flex min-h-screen flex-col bg-[#f7f3eb] text-[#243128]"><PublicHeader /><main className={`${SHELL} flex-1 py-24 text-center`}><h1 className="mr-title text-4xl">Atelier introuvable</h1><p className="mt-4 text-[#59635b]">Cette page n’est pas publiée ou n’existe plus.</p><a href="/professionnels" className="mt-8 inline-flex min-h-11 items-center underline underline-offset-4">Découvrir les professionnels</a></main><FineBinderyFooter /></div>;
}
