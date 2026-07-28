import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const adminSurfaces = [
  "src/routes/_authenticated/build/dashboard.tsx",
  "src/routes/_authenticated/build/workspaces.index.tsx",
  "src/routes/_authenticated/build/activity.tsx",
  "src/routes/_authenticated/build/knowledge.tsx",
  "src/routes/_authenticated/build/missions.index.tsx",
  "src/routes/_authenticated/build/missions.new.tsx",
  "src/routes/_authenticated/build/missions.$id.tsx",
  "src/build/pages/admin/onboarding/PublishStep.tsx",
] as const;

const forbiddenAdminCopy = [
  "Actualiser",
  "Aucun",
  "Aucune",
  "Ajouter un membre",
  "Créer",
  "Création",
  "Derniers",
  "Dernières",
  "Enregistrer",
  "Espaces Client",
  "Espace Client",
  "Activité",
  "Demandes",
  "Inscriptions",
  "Nouvelle mission",
  "Publier",
  "Publication",
  "Supprimer",
  "Détails techniques",
  "Créée",
  "Mise à jour",
  "Publiée",
  "Missions actives",
  "Nom de l'entreprise cliente",
  "Project Briefs ce mois-ci",
  "Retirer",
  "Vue d'ensemble",
  "approche de la limite",
  "limite atteinte",
  "soumise",
] as const;

describe("admin copy", () => {
  it("keeps the dashboard and client workspace screens in native English", () => {
    const source = adminSurfaces.map((path) => readFileSync(path, "utf8")).join("\n");

    for (const term of forbiddenAdminCopy) {
      expect(source).not.toContain(term);
    }
  });
});
