import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { admin, type Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findActiveBinderMembership } from "./binderMembership.server";
import { binderSkillLabel, binderSkillLabelEn } from "@/marketplace/binders/skills";
import {
  canPublishPublicProfile,
  fineBinderyProfilePath,
  PROFILE_REQUEST_SOURCE,
  PUBLIC_LANGUAGE_CODES,
  PUBLIC_MATERIAL_KEYS,
  PUBLIC_SPECIALTY_KEYS,
  PUBLIC_TECHNIQUE_KEYS,
  publicProfileMissing,
} from "@/marketplace/binders/fineBinderyProfile";
import { isValidReferralSlug, slugify } from "@/marketplace/binders/referral";

const PHOTO_BUCKET = "marketplace-binder-photos";
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 3600;

const publicProfileColumns = "id, display_name, workshop_name, city, postal_code, bio, training, avatar_path, status, personal_referral_slug, country_code, professional_email, professional_phone, website_url, instagram_url, workshop_photo_path, public_philosophy, spoken_languages, public_technique_keys, public_material_keys, public_profile_status, public_profile_published_at" as const;

const optionalText = (length: number) => z.string().trim().max(length).nullable();
const profileInput = z.object({
  workshopName: z.string().trim().min(2).max(200),
  professionalName: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  postalCode: optionalText(20),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  professionalEmail: z.string().trim().email().max(320).nullable(),
  professionalPhone: optionalText(50),
  websiteUrl: z.string().trim().url().max(500).nullable(),
  instagramUrl: z.string().trim().url().max(500).nullable(),
  bio: z.string().trim().min(20).max(3000),
  training: optionalText(3000),
  philosophy: optionalText(3000),
  languages: z.array(z.enum(PUBLIC_LANGUAGE_CODES as [string, ...string[]])).min(1).max(5),
  skills: z.array(z.enum(PUBLIC_SPECIALTY_KEYS as [string, ...string[]])).min(1).max(10),
  techniqueKeys: z.array(z.enum(PUBLIC_TECHNIQUE_KEYS as [string, ...string[]])).max(8),
  materialKeys: z.array(z.enum(PUBLIC_MATERIAL_KEYS as [string, ...string[]])).max(3),
}).strict();

const portfolioInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(2).max(180),
  description: optionalText(1500),
  year: z.number().int().min(1400).max(2200).nullable(),
  techniques: z.array(z.enum(PUBLIC_TECHNIQUE_KEYS as [string, ...string[]])).max(8),
  materials: z.array(z.enum(PUBLIC_MATERIAL_KEYS as [string, ...string[]])).max(3),
  publish: z.boolean(),
  consent: z.boolean(),
}).strict();

async function myBinder(sb: Supa, userId: string) {
  const membership = await findActiveBinderMembership(sb, userId);
  if (!membership) fail(403, "Aucun atelier actif n'est associé à ce compte.");
  const { data, error } = await sb.from("marketplace_binders")
    .select(publicProfileColumns).eq("id", membership!.binderId).maybeSingle();
  if (error || !data) fail(404, "Atelier introuvable.");
  return data!;
}

async function signedUrl(sb: Supa, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await sb.storage.from(PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

async function skillsFor(sb: Supa, binderId: string): Promise<string[]> {
  const { data, error } = await sb.from("marketplace_binder_skills")
    .select("skill_slug").eq("binder_id", binderId).order("skill_slug");
  if (error) throw error;
  return (data ?? []).map((row) => row.skill_slug);
}

async function portfolioFor(sb: Supa, binderId: string) {
  const { data, error } = await sb.from("marketplace_binder_portfolio").select("*")
    .eq("binder_id", binderId).order("position").order("created_at");
  if (error) throw error;
  return Promise.all((data ?? []).map(async (item) => ({
    ...item,
    beforePhotoUrl: await signedUrl(sb, item.before_photo_path),
    afterPhotoUrl: await signedUrl(sb, item.after_photo_path),
  })));
}

async function publicPortfolioFor(sb: Supa, binderId: string) {
  const { data, error } = await sb.from("marketplace_binder_portfolio")
    .select("id, title, description, techniques, materials, year, position, before_photo_path, after_photo_path")
    .eq("binder_id", binderId).eq("is_published", true)
    .not("publication_consent_at", "is", null).order("position").order("created_at");
  if (error) throw error;
  return Promise.all((data ?? []).map(async (item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    techniques: item.techniques,
    materials: item.materials,
    year: item.year,
    position: item.position,
    beforePhotoUrl: await signedUrl(sb, item.before_photo_path),
    afterPhotoUrl: await signedUrl(sb, item.after_photo_path),
  })));
}

async function reserveStableSlug(sb: Supa, binder: { id: string; personal_referral_slug: string | null; workshop_name: string | null; display_name: string }) {
  if (binder.personal_referral_slug) return binder.personal_referral_slug;
  const rawBase = slugify(binder.workshop_name || binder.display_name) || `atelier-${binder.id.slice(0, 8)}`;
  const base = rawBase.length >= 3 ? rawBase : `atelier-${binder.id.slice(0, 8)}`;
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const ending = suffix === 1 ? "" : `-${suffix}`;
    const candidate = `${base.slice(0, 64 - ending.length).replace(/-+$/g, "")}${ending}`;
    if (!isValidReferralSlug(candidate)) continue;
    const { data } = await sb.from("marketplace_binders").select("id")
      .eq("personal_referral_slug", candidate).maybeSingle();
    if (!data || data.id === binder.id) return candidate;
  }
  throw new Error("public_slug_unavailable");
}

async function projectProfile(sb: Supa, binder: Awaited<ReturnType<typeof myBinder>>) {
  const [skills, portfolio, logoUrl, workshopPhotoUrl] = await Promise.all([
    skillsFor(sb, binder.id),
    portfolioFor(sb, binder.id),
    signedUrl(sb, binder.avatar_path),
    signedUrl(sb, binder.workshop_photo_path),
  ]);
  const missing = publicProfileMissing({ workshopName: binder.workshop_name, city: binder.city, bio: binder.bio, skills });
  return {
    id: binder.id,
    workshopName: binder.workshop_name ?? "",
    professionalName: binder.display_name,
    city: binder.city ?? "",
    postalCode: binder.postal_code,
    countryCode: binder.country_code,
    professionalEmail: binder.professional_email,
    professionalPhone: binder.professional_phone,
    websiteUrl: binder.website_url,
    instagramUrl: binder.instagram_url,
    bio: binder.bio ?? "",
    training: binder.training,
    philosophy: binder.public_philosophy,
    languages: binder.spoken_languages,
    skills,
    techniqueKeys: binder.public_technique_keys,
    materialKeys: binder.public_material_keys,
    profileStatus: binder.public_profile_status,
    publishedAt: binder.public_profile_published_at,
    approvalStatus: binder.status,
    slug: binder.personal_referral_slug,
    publicPath: binder.personal_referral_slug ? fineBinderyProfilePath(binder.personal_referral_slug) : null,
    logoUrl,
    workshopPhotoUrl,
    missing,
    ready: missing.length === 0,
    portfolio,
  };
}

export const getMyFineBinderyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    return projectProfile(sb, await myBinder(sb, context.userId));
  });

export const saveMyFineBinderyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => profileInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await myBinder(sb, context.userId);
    const slug = await reserveStableSlug(sb, binder);
    const { error } = await sb.from("marketplace_binders").update({
      workshop_name: data.workshopName,
      display_name: data.professionalName,
      city: data.city,
      postal_code: data.postalCode,
      country_code: data.countryCode,
      professional_email: data.professionalEmail,
      professional_phone: data.professionalPhone,
      website_url: data.websiteUrl,
      instagram_url: data.instagramUrl,
      bio: data.bio,
      training: data.training,
      public_philosophy: data.philosophy,
      spoken_languages: [...new Set(data.languages)],
      public_technique_keys: [...new Set(data.techniqueKeys)],
      public_material_keys: [...new Set(data.materialKeys)],
      personal_referral_slug: slug,
    }).eq("id", binder.id);
    if (error) fail(500, error.message);

    const current = new Set(await skillsFor(sb, binder.id));
    const desired = new Set(data.skills);
    const removed = [...current].filter((skill) => !desired.has(skill));
    const added = [...desired].filter((skill) => !current.has(skill));
    if (removed.length) {
      const result = await sb.from("marketplace_binder_skills").delete()
        .eq("binder_id", binder.id).in("skill_slug", removed);
      if (result.error) fail(500, result.error.message);
    }
    if (added.length) {
      const result = await sb.from("marketplace_binder_skills").insert(added.map((skill) => ({ binder_id: binder.id, skill_slug: skill })));
      if (result.error) fail(500, result.error.message);
    }
    return projectProfile(sb, await myBinder(sb, context.userId));
  });

export const setMyFineBinderyProfilePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ publish: z.boolean() }).strict().parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    let binder = await myBinder(sb, context.userId);
    const skills = await skillsFor(sb, binder.id);
    if (data.publish) {
      if (binder.status !== "approved") fail(409, "L'atelier doit être approuvé avant publication.");
      const missing = publicProfileMissing({ workshopName: binder.workshop_name, city: binder.city, bio: binder.bio, skills });
      if (missing.length) fail(409, `Profil incomplet : ${missing.join(", ")}.`);
      const slug = await reserveStableSlug(sb, binder);
      const { error } = await sb.from("marketplace_binders").update({
        personal_referral_slug: slug,
        public_profile_status: "published",
        public_profile_published_at: new Date().toISOString(),
      }).eq("id", binder.id);
      if (error) fail(500, error.message);
    } else {
      const { error } = await sb.from("marketplace_binders").update({
        public_profile_status: "draft",
        public_profile_published_at: null,
      }).eq("id", binder.id);
      if (error) fail(500, error.message);
    }
    binder = await myBinder(sb, context.userId);
    return projectProfile(sb, binder);
  });

const uploadInput = z.object({
  target: z.enum(["logo", "workshop"]),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  imageBase64: z.string().min(1),
}).strict();

export const uploadMyFineBinderyProfileImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => uploadInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await myBinder(sb, context.userId);
    const bytes = Buffer.from(data.imageBase64, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) fail(400, "Image invalide ou supérieure à 8 Mo.");
    const extension = data.mimeType === "image/png" ? "png" : "jpg";
    const path = `${binder.id}/public-profile/${data.target}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await sb.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (uploadError) fail(500, uploadError.message);
    const previous = data.target === "logo" ? binder.avatar_path : binder.workshop_photo_path;
    const imageUpdate = data.target === "logo" ? { avatar_path: path } : { workshop_photo_path: path };
    const { error } = await sb.from("marketplace_binders").update(imageUpdate).eq("id", binder.id);
    if (error) {
      await sb.storage.from(PHOTO_BUCKET).remove([path]);
      fail(500, error.message);
    }
    if (previous) await sb.storage.from(PHOTO_BUCKET).remove([previous]);
    return projectProfile(sb, await myBinder(sb, context.userId));
  });

export const createMyFineBinderyPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    title: z.string().trim().min(2).max(180),
    sourceWorkId: z.string().uuid().nullable(),
  }).strict().parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await myBinder(sb, context.userId);
    if (data.sourceWorkId) {
      const { data: work } = await sb.from("marketplace_binder_works").select("id")
        .eq("id", data.sourceWorkId).eq("binder_id", binder.id).maybeSingle();
      if (!work) fail(404, "Ouvrage introuvable.");
    }
    const { data: last } = await sb.from("marketplace_binder_portfolio").select("position")
      .eq("binder_id", binder.id).order("position", { ascending: false }).limit(1).maybeSingle();
    const { data: item, error } = await sb.from("marketplace_binder_portfolio").insert({
      binder_id: binder.id,
      title: data.title,
      source_work_id: data.sourceWorkId,
      position: (last?.position ?? -1) + 1,
    }).select("id").single();
    if (error || !item) fail(500, error?.message ?? "Création impossible.");
    return { id: item!.id };
  });

export const saveMyFineBinderyPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => portfolioInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await myBinder(sb, context.userId);
    const { data: existing } = await sb.from("marketplace_binder_portfolio")
      .select("id, before_photo_path, after_photo_path").eq("id", data.id).eq("binder_id", binder.id).maybeSingle();
    if (!existing) fail(404, "Réalisation introuvable.");
    if (data.publish && (!data.consent || (!existing!.before_photo_path && !existing!.after_photo_path))) {
      fail(409, "Une photo et le consentement explicite sont requis pour publier.");
    }
    const { error } = await sb.from("marketplace_binder_portfolio").update({
      title: data.title,
      description: data.description,
      year: data.year,
      techniques: [...new Set(data.techniques)],
      materials: [...new Set(data.materials)],
      is_published: data.publish,
      publication_consent_at: data.publish && data.consent ? new Date().toISOString() : null,
    }).eq("id", data.id).eq("binder_id", binder.id);
    if (error) fail(500, error.message);
    return projectProfile(sb, await myBinder(sb, context.userId));
  });

const portfolioPhotoInput = z.object({
  id: z.string().uuid(),
  side: z.enum(["before", "after"]),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  imageBase64: z.string().min(1),
}).strict();

export const uploadMyFineBinderyPortfolioPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => portfolioPhotoInput.parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await myBinder(sb, context.userId);
    const { data: item } = await sb.from("marketplace_binder_portfolio")
      .select("id, before_photo_path, after_photo_path").eq("id", data.id).eq("binder_id", binder.id).maybeSingle();
    if (!item) fail(404, "Réalisation introuvable.");
    const bytes = Buffer.from(data.imageBase64, "base64");
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) fail(400, "Image invalide ou supérieure à 8 Mo.");
    const extension = data.mimeType === "image/png" ? "png" : "jpg";
    const path = `${binder.id}/portfolio/${data.id}/${data.side}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await sb.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (uploadError) fail(500, uploadError.message);
    const previous = data.side === "before" ? item!.before_photo_path : item!.after_photo_path;
    const photoUpdate = data.side === "before"
      ? { before_photo_path: path, is_published: false, publication_consent_at: null }
      : { after_photo_path: path, is_published: false, publication_consent_at: null };
    const { error } = await sb.from("marketplace_binder_portfolio").update(photoUpdate)
      .eq("id", data.id).eq("binder_id", binder.id);
    if (error) {
      await sb.storage.from(PHOTO_BUCKET).remove([path]);
      fail(500, error.message);
    }
    if (previous) await sb.storage.from(PHOTO_BUCKET).remove([previous]);
    return projectProfile(sb, await myBinder(sb, context.userId));
  });

export const deleteMyFineBinderyPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).strict().parse(data))
  .handler(async ({ context, data }) => {
    const sb = await admin();
    const binder = await myBinder(sb, context.userId);
    const { data: item } = await sb.from("marketplace_binder_portfolio")
      .select("id, before_photo_path, after_photo_path").eq("id", data.id).eq("binder_id", binder.id).maybeSingle();
    if (!item) fail(404, "Réalisation introuvable.");
    const { error } = await sb.from("marketplace_binder_portfolio").delete().eq("id", data.id).eq("binder_id", binder.id);
    if (error) fail(500, error.message);
    const paths = [item!.before_photo_path, item!.after_photo_path].filter((value): value is string => Boolean(value));
    if (paths.length) await sb.storage.from(PHOTO_BUCKET).remove(paths);
    return { ok: true as const };
  });

async function publicBinderRows(sb: Supa) {
  const { data, error } = await sb.from("marketplace_binders").select(publicProfileColumns)
    .eq("status", "approved").eq("public_profile_status", "published")
    .not("personal_referral_slug", "is", null).order("workshop_name");
  if (error) throw error;
  return data ?? [];
}

export const listPublicFineBinderyProfiles = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = await admin();
    const rows = await publicBinderRows(sb);
    return Promise.all(rows.map(async (binder) => {
      const skills = await skillsFor(sb, binder.id);
      return {
        slug: binder.personal_referral_slug!,
        path: fineBinderyProfilePath(binder.personal_referral_slug!),
        workshopName: binder.workshop_name ?? binder.display_name,
        professionalName: binder.display_name,
        city: binder.city!,
        countryCode: binder.country_code,
        bio: binder.bio!,
        languages: binder.spoken_languages,
        skills: skills.map((slug) => ({ slug, label: binderSkillLabel(slug), labelEn: binderSkillLabelEn(slug) })),
        imageUrl: await signedUrl(sb, binder.workshop_photo_path || binder.avatar_path),
      };
    }));
  });

export const getPublicFineBinderyProfile = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: z.string().min(3).max(64) }).strict().parse(data))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: binder, error } = await sb.from("marketplace_binders").select(publicProfileColumns)
      .eq("personal_referral_slug", data.slug).eq("status", "approved")
      .eq("public_profile_status", "published").maybeSingle();
    if (error || !binder) return null;
    const [skills, portfolio, logoUrl, workshopPhotoUrl] = await Promise.all([
      skillsFor(sb, binder.id), publicPortfolioFor(sb, binder.id),
      signedUrl(sb, binder.avatar_path), signedUrl(sb, binder.workshop_photo_path),
    ]);
    if (!canPublishPublicProfile({ workshopName: binder.workshop_name, city: binder.city, bio: binder.bio, skills })) return null;
    return {
      slug: binder.personal_referral_slug!,
      workshopName: binder.workshop_name!,
      professionalName: binder.display_name,
      city: binder.city!,
      postalCode: binder.postal_code,
      countryCode: binder.country_code,
      professionalEmail: binder.professional_email,
      professionalPhone: binder.professional_phone,
      websiteUrl: binder.website_url,
      instagramUrl: binder.instagram_url,
      bio: binder.bio!,
      training: binder.training,
      philosophy: binder.public_philosophy,
      languages: binder.spoken_languages,
      skills: skills.map((slug) => ({ slug, label: binderSkillLabel(slug), labelEn: binderSkillLabelEn(slug) })),
      techniqueKeys: binder.public_technique_keys,
      materialKeys: binder.public_material_keys,
      logoUrl,
      workshopPhotoUrl,
      portfolio,
      request: { source: PROFILE_REQUEST_SOURCE, referralSlug: binder.personal_referral_slug! },
    };
  });
