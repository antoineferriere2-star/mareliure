import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createMyFineBinderyPortfolioItem,
  deleteMyFineBinderyPortfolioItem,
  getMyFineBinderyProfile,
  saveMyFineBinderyPortfolioItem,
  saveMyFineBinderyProfile,
  setMyFineBinderyProfilePublication,
  uploadMyFineBinderyPortfolioPhoto,
  uploadMyFineBinderyProfileImage,
} from "@/marketplace/services/fineBinderyProfile.data.functions";
import { BINDER_SKILLS } from "@/marketplace/binders/skills";
import { PUBLIC_LANGUAGES, PUBLIC_MATERIALS, PUBLIC_TECHNIQUES } from "@/marketplace/binders/fineBinderyProfile";
import { BinderLoading, BinderPageHeader, BinderSectionTitle } from "./BinderPageUi";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON } from "./quotes/quoteUi";
import { getMyWorks } from "@/marketplace/services/binderWorks.data.functions";

const PROFILE_KEY = ["marketplace", "binder", "public-profile"] as const;
type Profile = Awaited<ReturnType<typeof getMyFineBinderyProfile>>;
type PortfolioItem = Profile["portfolio"][number];

async function imageBase64(file: File): Promise<string> {
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("invalid_image");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return dataUrl.split(",")[1] ?? "";
}

export function PublicProfilePage() {
  const load = useServerFn(getMyFineBinderyProfile);
  const query = useQuery({ queryKey: PROFILE_KEY, queryFn: () => load() });
  if (query.isPending) return <BinderLoading label="Préparation de votre profil FineBindery…" />;
  if (query.isError || !query.data) return <ErrorNote>Votre profil public n’a pas pu être chargé.</ErrorNote>;
  return <PublicProfileEditor key={`${query.data.id}-${query.data.publishedAt ?? "draft"}`} profile={query.data} />;
}

function PublicProfileEditor({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const saveProfile = useServerFn(saveMyFineBinderyProfile);
  const publishProfile = useServerFn(setMyFineBinderyProfilePublication);
  const uploadProfileImage = useServerFn(uploadMyFineBinderyProfileImage);
  const createPortfolio = useServerFn(createMyFineBinderyPortfolioItem);
  const loadWorks = useServerFn(getMyWorks);
  const works = useQuery({ queryKey: ["binder", "works", "public-profile"], queryFn: () => loadWorks({ data: {} }) });
  const [draft, setDraft] = useState({ ...profile });
  const [newTitle, setNewTitle] = useState("");
  const [sourceWorkId, setSourceWorkId] = useState("");
  const [notice, setNotice] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const workshopInput = useRef<HTMLInputElement>(null);
  const apply = (next: Profile) => {
    queryClient.setQueryData(PROFILE_KEY, next);
    setDraft(next);
  };
  const set = (patch: Partial<Profile>) => setDraft((current) => ({ ...current, ...patch }));
  const toggle = (key: "languages" | "skills" | "techniqueKeys" | "materialKeys", value: string) => {
    const values = draft[key] as string[];
    set({ [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] } as Partial<Profile>);
  };

  const save = useMutation({
    mutationFn: () => saveProfile({ data: {
      workshopName: draft.workshopName,
      professionalName: draft.professionalName,
      city: draft.city,
      postalCode: draft.postalCode || null,
      countryCode: draft.countryCode,
      professionalEmail: draft.professionalEmail || null,
      professionalPhone: draft.professionalPhone || null,
      websiteUrl: draft.websiteUrl || null,
      instagramUrl: draft.instagramUrl || null,
      bio: draft.bio,
      training: draft.training || null,
      philosophy: draft.philosophy || null,
      languages: draft.languages,
      skills: draft.skills,
      techniqueKeys: draft.techniqueKeys,
      materialKeys: draft.materialKeys,
    } }),
    onSuccess: (next) => { apply(next); setNotice("Profil enregistré"); },
  });
  const publication = useMutation({
    mutationFn: (publish: boolean) => publishProfile({ data: { publish } }),
    onSuccess: (next) => { apply(next); setNotice(next.profileStatus === "published" ? "Profil publié" : "Profil repassé en brouillon"); },
  });
  const image = useMutation({
    mutationFn: async ({ file, target }: { file: File; target: "logo" | "workshop" }) => uploadProfileImage({ data: { target, mimeType: file.type as "image/jpeg" | "image/png", imageBase64: await imageBase64(file) } }),
    onSuccess: apply,
  });
  const create = useMutation({
    mutationFn: () => createPortfolio({ data: { title: newTitle, sourceWorkId: sourceWorkId || null } }),
    onSuccess: async () => { setNewTitle(""); setSourceWorkId(""); await queryClient.invalidateQueries({ queryKey: PROFILE_KEY }); },
  });

  return <div className="space-y-9">
    <BinderPageHeader eyebrow="FineBindery Network" title="Profil public" description="Votre page professionnelle partage votre savoir-faire. Rien provenant d’un ouvrage privé n’y paraît sans votre action explicite." action={draft.publicPath && draft.profileStatus === "published" ? <a href={draft.publicPath} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center border border-[#7a2230] px-4 text-sm font-semibold text-[#5f1b27]">Voir ma page publique</a> : undefined} />

    <div className={`border-l-4 px-5 py-4 text-sm ${draft.profileStatus === "published" ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-amber-700 bg-amber-50 text-amber-950"}`}>
      <strong className="block">{draft.profileStatus === "published" ? "Profil publié" : "Profil incomplet ou non publié"}</strong>
      <p className="mt-1">{draft.missing.length ? `À compléter : ${draft.missing.join(", ")}.` : draft.approvalStatus !== "approved" ? "Le profil est prêt. L’atelier doit encore être approuvé avant publication." : "Le profil peut être publié sur FineBindery."}</p>
      {draft.slug && <p className="mt-2 font-mono text-xs">finebindery.com/fr/{draft.slug}</p>}
    </div>

    <section className={CARD}>
      <BinderSectionTitle title="Identité professionnelle" detail="Les coordonnées saisies ici sont destinées à être publiques." />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l’atelier" htmlFor="public-workshop"><input id="public-workshop" className={FIELD} value={draft.workshopName} onChange={(event) => set({ workshopName: event.target.value })} /></Field>
        <Field label="Nom du professionnel" htmlFor="public-name"><input id="public-name" className={FIELD} value={draft.professionalName} onChange={(event) => set({ professionalName: event.target.value })} /></Field>
        <Field label="Ville" htmlFor="public-city"><input id="public-city" className={FIELD} value={draft.city} onChange={(event) => set({ city: event.target.value })} /></Field>
        <Field label="Code postal" htmlFor="public-postal"><input id="public-postal" className={FIELD} value={draft.postalCode ?? ""} onChange={(event) => set({ postalCode: event.target.value || null })} /></Field>
        <Field label="Pays" htmlFor="public-country"><select id="public-country" className={FIELD} value={draft.countryCode} onChange={(event) => set({ countryCode: event.target.value })}><option value="FR">France</option></select></Field>
        <Field label="E-mail professionnel" htmlFor="public-email"><input id="public-email" type="email" className={FIELD} value={draft.professionalEmail ?? ""} onChange={(event) => set({ professionalEmail: event.target.value || null })} /></Field>
        <Field label="Téléphone professionnel" htmlFor="public-phone"><input id="public-phone" type="tel" className={FIELD} value={draft.professionalPhone ?? ""} onChange={(event) => set({ professionalPhone: event.target.value || null })} /></Field>
        <Field label="Site web" htmlFor="public-website"><input id="public-website" type="url" className={FIELD} placeholder="https://" value={draft.websiteUrl ?? ""} onChange={(event) => set({ websiteUrl: event.target.value || null })} /></Field>
        <Field label="Instagram" htmlFor="public-instagram"><input id="public-instagram" type="url" className={FIELD} placeholder="https://instagram.com/…" value={draft.instagramUrl ?? ""} onChange={(event) => set({ instagramUrl: event.target.value || null })} /></Field>
      </div>
      <div className="mt-5 grid gap-5 border-t border-[#d8d0c4] pt-5 sm:grid-cols-2">
        <ImagePicker title="Logo" imageUrl={draft.logoUrl} inputRef={logoInput} onPick={(file) => image.mutate({ file, target: "logo" })} />
        <ImagePicker title="Photo de l’atelier" imageUrl={draft.workshopPhotoUrl} inputRef={workshopInput} onPick={(file) => image.mutate({ file, target: "workshop" })} />
      </div>
    </section>

    <section className={CARD}>
      <BinderSectionTitle title="Présentation" detail="Une voix personnelle, sans jargon de plateforme." />
      <div className="mt-5 space-y-4">
        <Field label="Présentation" htmlFor="public-bio"><textarea id="public-bio" rows={6} className={`${FIELD} h-auto py-3`} value={draft.bio} onChange={(event) => set({ bio: event.target.value })} /></Field>
        <Field label="Parcours" htmlFor="public-training"><textarea id="public-training" rows={4} className={`${FIELD} h-auto py-3`} value={draft.training ?? ""} onChange={(event) => set({ training: event.target.value || null })} /></Field>
        <Field label="Approche et philosophie" htmlFor="public-philosophy"><textarea id="public-philosophy" rows={4} className={`${FIELD} h-auto py-3`} value={draft.philosophy ?? ""} onChange={(event) => set({ philosophy: event.target.value || null })} /></Field>
      </div>
    </section>

    <section className={CARD}>
      <BinderSectionTitle title="Expertise structurée" detail="Ces choix préparent la recherche du réseau sans créer une taxonomie parallèle." />
      <ChoiceGroup title="Spécialités" values={draft.skills} options={BINDER_SKILLS.map((item) => ({ key: item.slug, label: item.label }))} onToggle={(value) => toggle("skills", value)} />
      <ChoiceGroup title="Langues" values={draft.languages} options={PUBLIC_LANGUAGES.map((item) => ({ key: item.code, label: item.label }))} onToggle={(value) => toggle("languages", value)} />
      <ChoiceGroup title="Techniques principales" values={draft.techniqueKeys} options={PUBLIC_TECHNIQUES} onToggle={(value) => toggle("techniqueKeys", value)} />
      <ChoiceGroup title="Matières principales" values={draft.materialKeys} options={PUBLIC_MATERIALS} onToggle={(value) => toggle("materialKeys", value)} />
    </section>

    <section className="space-y-5">
      <BinderSectionTitle title="Réalisations" detail="Une réalisation reste privée tant que vous n’avez pas confirmé sa publication." count={draft.portfolio.length} />
      <form className="grid gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); if (newTitle.trim()) create.mutate(); }}>
        <Field label="Partir d’un ouvrage (facultatif)" htmlFor="portfolio-source-work"><select id="portfolio-source-work" className={FIELD} value={sourceWorkId} onChange={(event) => { const id = event.target.value; setSourceWorkId(id); const work = works.data?.find((candidate) => candidate.id === id); if (work) setNewTitle(work.title); }}><option value="">Réalisation indépendante</option>{works.data?.map((work) => <option key={work.id} value={work.id}>{work.reference} · {work.title}</option>)}</select></Field>
        <Field label="Titre de la réalisation" htmlFor="portfolio-new-title"><input id="portfolio-new-title" className={FIELD} placeholder="Ex. Restauration d’un plein cuir du XIXe siècle" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} /></Field>
        <button type="submit" className={PRIMARY_BUTTON} disabled={!newTitle.trim() || create.isPending}>Ajouter</button>
      </form>
      <div className="space-y-5">{draft.portfolio.map((item) => <PortfolioEditor key={item.id} item={item} onChanged={(next) => apply(next)} onDeleted={async () => { await queryClient.invalidateQueries({ queryKey: PROFILE_KEY }); }} />)}</div>
    </section>

    {(save.isError || publication.isError || image.isError || create.isError) && <ErrorNote>L’action n’a pas pu être enregistrée. Vérifiez les champs, les images et l’état de validation de l’atelier.</ErrorNote>}
    <div className="flex flex-wrap items-center gap-3 border border-[#cfc5b6] bg-[#fffdf8]/95 p-4 shadow-lg backdrop-blur lg:sticky lg:bottom-4 lg:z-20">
      <button type="button" className={PRIMARY_BUTTON} onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer le profil</button>
      <button type="button" className="min-h-11 border border-[#7a2230] px-4 text-sm font-semibold text-[#5f1b27]" onClick={() => publication.mutate(draft.profileStatus !== "published")} disabled={publication.isPending || (draft.profileStatus !== "published" && (!draft.ready || draft.approvalStatus !== "approved"))}>{draft.profileStatus === "published" ? "Retirer de FineBindery" : "Publier sur FineBindery"}</button>
      {notice && <span role="status" className="text-sm text-emerald-700">{notice}</span>}
    </div>
  </div>;
}

function ImagePicker({ title, imageUrl, inputRef, onPick }: { title: string; imageUrl: string | null; inputRef: React.RefObject<HTMLInputElement | null>; onPick: (file: File) => void }) {
  return <div><p className="text-sm font-semibold">{title}</p>{imageUrl ? <img src={imageUrl} alt={title} className="mt-3 h-32 w-full object-cover" /> : <div className="mt-3 flex h-32 items-center justify-center bg-[#efe9de] text-sm text-[#74695d]">Aucune image</div>}<input ref={inputRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.currentTarget.value = ""; }} /><button type="button" className="mt-3 min-h-11 border border-[#b9ad9d] bg-white px-4 text-sm font-semibold" onClick={() => inputRef.current?.click()}>{imageUrl ? "Remplacer" : "Ajouter"}</button><p className="mt-2 text-xs text-[#74695d]">JPEG ou PNG, 8 Mo maximum.</p></div>;
}

function ChoiceGroup({ title, values, options, onToggle }: { title: string; values: string[]; options: readonly { key: string; label: string }[]; onToggle: (value: string) => void }) {
  return <fieldset className="mt-6 border-t border-[#d8d0c4] pt-5"><legend className="text-sm font-semibold">{title}</legend><div className="mt-3 flex flex-wrap gap-2">{options.map((option) => <label key={option.key} className={`flex min-h-11 cursor-pointer items-center gap-2 border px-3 text-sm ${values.includes(option.key) ? "border-[#36513e] bg-[#e8eee9] text-[#203529]" : "border-[#cfc5b6] bg-white"}`}><input type="checkbox" checked={values.includes(option.key)} onChange={() => onToggle(option.key)} />{option.label}</label>)}</div></fieldset>;
}

function PortfolioEditor({ item, onChanged, onDeleted }: { item: PortfolioItem; onChanged: (profile: Profile) => void; onDeleted: () => Promise<void> }) {
  const saveItem = useServerFn(saveMyFineBinderyPortfolioItem);
  const uploadPhoto = useServerFn(uploadMyFineBinderyPortfolioPhoto);
  const removeItem = useServerFn(deleteMyFineBinderyPortfolioItem);
  const [draft, setDraft] = useState({ title: item.title, description: item.description ?? "", year: item.year ? String(item.year) : "", techniques: item.techniques ?? [], materials: item.materials ?? [], publish: item.is_published, consent: Boolean(item.publication_consent_at) });
  const mutation = useMutation({ mutationFn: () => saveItem({ data: { id: item.id, title: draft.title, description: draft.description || null, year: draft.year ? Number(draft.year) : null, techniques: draft.techniques as (typeof PUBLIC_TECHNIQUES)[number]["key"][], materials: draft.materials as (typeof PUBLIC_MATERIALS)[number]["key"][], publish: draft.publish, consent: draft.consent } }), onSuccess: onChanged });
  const photo = useMutation({ mutationFn: async ({ file, side }: { file: File; side: "before" | "after" }) => uploadPhoto({ data: { id: item.id, side, mimeType: file.type as "image/jpeg" | "image/png", imageBase64: await imageBase64(file) } }), onSuccess: onChanged });
  const remove = useMutation({ mutationFn: () => removeItem({ data: { id: item.id } }), onSuccess: onDeleted });
  const toggleValue = (key: "techniques" | "materials", value: string) => setDraft((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((itemKey) => itemKey !== value) : [...current[key], value] }));
  return <article className={CARD}>
    <div className="grid gap-5 sm:grid-cols-2"><PortfolioPhoto label="Avant" url={item.beforePhotoUrl} onPick={(file) => photo.mutate({ file, side: "before" })} /><PortfolioPhoto label="Après" url={item.afterPhotoUrl} onPick={(file) => photo.mutate({ file, side: "after" })} /></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]"><Field label="Titre" htmlFor={`portfolio-title-${item.id}`}><input id={`portfolio-title-${item.id}`} className={FIELD} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></Field><Field label="Année" htmlFor={`portfolio-year-${item.id}`}><input id={`portfolio-year-${item.id}`} inputMode="numeric" className={FIELD} value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))} /></Field></div>
    <div className="mt-4"><Field label="Description" htmlFor={`portfolio-description-${item.id}`}><textarea id={`portfolio-description-${item.id}`} rows={3} className={`${FIELD} h-auto py-3`} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></Field></div>
    <ChoiceGroup title="Techniques" values={draft.techniques} options={PUBLIC_TECHNIQUES} onToggle={(value) => toggleValue("techniques", value)} />
    <ChoiceGroup title="Matières" values={draft.materials} options={PUBLIC_MATERIALS} onToggle={(value) => toggleValue("materials", value)} />
    <div className="mt-5 border-t border-[#d8d0c4] pt-5"><label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" checked={draft.consent} onChange={(event) => setDraft((current) => ({ ...current, consent: event.target.checked, publish: event.target.checked ? current.publish : false }))} /><span>Je confirme disposer de l’autorisation nécessaire pour publier ces images. Elles ne révèlent aucune donnée personnelle, conversation, note, prix ou document privé.</span></label><label className="mt-2 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={draft.publish} disabled={!draft.consent || (!item.before_photo_path && !item.after_photo_path)} onChange={(event) => setDraft((current) => ({ ...current, publish: event.target.checked }))} />Afficher cette réalisation sur ma page publique</label></div>
    {(mutation.isError || photo.isError || remove.isError) && <ErrorNote>Cette réalisation n’a pas pu être enregistrée.</ErrorNote>}
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={PRIMARY_BUTTON} onClick={() => mutation.mutate()} disabled={mutation.isPending}>Enregistrer</button><button type="button" className="min-h-11 px-3 text-sm font-semibold text-red-800" onClick={() => remove.mutate()} disabled={remove.isPending}>Supprimer</button></div>
  </article>;
}

function PortfolioPhoto({ label, url, onPick }: { label: string; url: string | null; onPick: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#74695d]">{label}</p>{url ? <img src={url} alt={`${label} intervention`} className="mt-2 aspect-[4/3] w-full object-cover" /> : <div className="mt-2 flex aspect-[4/3] items-center justify-center bg-[#efe9de] text-sm text-[#74695d]">Photo {label.toLowerCase()}</div>}<input ref={input} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onPick(file); event.currentTarget.value = ""; }} /><button type="button" className="mt-2 min-h-11 border border-[#b9ad9d] bg-white px-3 text-sm font-semibold" onClick={() => input.current?.click()}>{url ? "Remplacer" : "Ajouter la photo"}</button></div>;
}
