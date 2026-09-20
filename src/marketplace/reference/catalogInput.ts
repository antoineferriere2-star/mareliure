/**
 * Ce que le navigateur a le droit d'envoyer pour AJOUTER une opération du référentiel à son catalogue —
 * et rien d'autre. `.strict()` : un champ en plus est refusé, pas ignoré.
 *
 * Le relieur reste propriétaire du libellé, de l'unité, du prix, de la description, du favori. Il n'y a
 * ICI aucun champ de prix venu du référentiel : le prix est saisi par l'atelier (jamais prérempli), et
 * n'a d'ailleurs aucune source dans la ressource.
 */
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const referenceServiceInput = z
  .object({
    referenceVersion: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Version de référentiel invalide"),
    /** Une clé stable `OPR-0000` — jamais un slug. */
    referenceOperationKey: z.string().regex(/^OPR-[0-9]{4}$/, "Clé d'opération invalide"),
    name: text(200).min(1, "Nom requis"),
    description: optionalText(1000),
    /** Libre : le vocabulaire du référentiel PROPOSE, il n'enferme pas. */
    unit: optionalText(40),
    unitPriceCents: z.number().int().min(0).max(100_000_000),
    vatRateBps: z.number().int().min(0).max(10_000).nullable(),
    categoryId: z.string().uuid().nullable(),
    isFavorite: z.boolean(),
  })
  .strict();

export const favoriteInput = z.object({ id: z.string().uuid(), isFavorite: z.boolean() }).strict();

export type ReferenceServiceInput = z.infer<typeof referenceServiceInput>;
export type FavoriteInput = z.infer<typeof favoriteInput>;
