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
  "src/routes/_authenticated/build/dossiers.index.tsx",
  "src/routes/_authenticated/build/dossiers.$id.tsx",
  "src/routes/_authenticated/build/requests.index.tsx",
  "src/routes/_authenticated/build/requests.$id.tsx",
  "src/routes/_authenticated/build/playbooks.index.tsx",
  "src/routes/_authenticated/build/playbooks.$id.tsx",
  "src/routes/_authenticated/build/settings.tsx",
  "src/routes/_authenticated/build/onboarding.tsx",
  "src/build/pages/admin/AdminStub.tsx",
  "src/build/pages/admin/onboarding/CustomizeStep.tsx",
  "src/build/pages/admin/onboarding/PlaybookMatchStep.tsx",
  "src/build/pages/admin/onboarding/PreviewStep.tsx",
  "src/build/pages/admin/onboarding/PublishStep.tsx",
  "src/build/pages/admin/onboarding/UrlStep.tsx",
  "src/build/pages/admin/playbookEditor/BriefConfigEditor.tsx",
  "src/build/pages/admin/playbookEditor/ConditionGroupEditor.tsx",
  "src/build/pages/admin/playbookEditor/FieldEditor.tsx",
  "src/build/pages/admin/playbookEditor/FieldPicker.tsx",
  "src/build/pages/admin/playbookEditor/OptionsListEditor.tsx",
  "src/build/pages/admin/playbookEditor/ValidationRulesEditor.tsx",
  "src/build/pages/admin/playbookEditor/briefSectionLabels.ts",
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
