import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listPublishablePlaybooks } from "@/build/services/admin.data.functions";
import {
  analyzeOnboardingSite,
  createAndPublishMissionFromOnboarding,
  getPublishedPlaybookSchema,
} from "@/build/services/onboarding.data.functions";
import { matchPlaybookForProduct, type PlaybookMatch } from "@/build/onboarding/matchPlaybook";
import type { MissionProposal } from "@/build/schema/missionProposal";
import type { PlaybookSchema } from "@/build/schema/playbook";
import { UrlStep } from "@/build/pages/admin/onboarding/UrlStep";
import { SingleChoiceConfirmStep } from "@/build/pages/admin/onboarding/SingleChoiceConfirmStep";
import { PlaybookMatchStep } from "@/build/pages/admin/onboarding/PlaybookMatchStep";
import { CustomizeStep } from "@/build/pages/admin/onboarding/CustomizeStep";
import { PreviewStep } from "@/build/pages/admin/onboarding/PreviewStep";
import { PublishStep } from "@/build/pages/admin/onboarding/PublishStep";

export const Route = createFileRoute("/_authenticated/build/onboarding")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Onboarding — Métré Build AI" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OnboardingPage,
});

type Step =
  "url" | "businessType" | "product" | "playbookMatch" | "customize" | "preview" | "publish";

const STEP_ORDER: Step[] = [
  "url",
  "businessType",
  "product",
  "playbookMatch",
  "customize",
  "preview",
  "publish",
];
const STEP_LABELS: Record<Step, string> = {
  url: "URL",
  businessType: "Métier",
  product: "Produit",
  playbookMatch: "Playbook",
  customize: "Personnalisation",
  preview: "Aperçu",
  publish: "Publication",
};

function OnboardingPage() {
  const [step, setStep] = useState<Step>("url");

  const [url, setUrl] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [businessTypeCandidates, setBusinessTypeCandidates] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [businessType, setBusinessType] = useState("");
  const [product, setProduct] = useState("");
  const [missionName, setMissionName] = useState("");
  const [objective, setObjective] = useState("");
  const [proposal, setProposal] = useState<MissionProposal>({});
  const [schema, setSchema] = useState<PlaybookSchema | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const analyzeFn = useServerFn(analyzeOnboardingSite);
  const schemaFn = useServerFn(getPublishedPlaybookSchema);
  const publishFn = useServerFn(createAndPublishMissionFromOnboarding);
  const listPlaybooksFn = useServerFn(listPublishablePlaybooks);

  const playbooksQuery = useQuery({
    queryKey: ["build-admin", "playbooks", "publishable"],
    queryFn: () => listPlaybooksFn(),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeFn({ data: { url } }),
    onSuccess: (result) => {
      setBusinessTypeCandidates(result.businessTypeCandidates);
      setProducts(result.products);
      setAnalyzeError(null);
      setStep("businessType");
    },
    onError: (err: unknown) =>
      setAnalyzeError(err instanceof Error ? err.message : "Analyse impossible."),
  });

  const match: PlaybookMatch | null =
    businessType && product
      ? matchPlaybookForProduct(businessType, product, playbooksQuery.data ?? [])
      : null;

  const schemaMutation = useMutation({
    mutationFn: (playbookId: string) => schemaFn({ data: { playbookId } }),
    onSuccess: (data) => setSchema(data),
  });

  useEffect(() => {
    if (step === "preview" && match && !schema && !schemaMutation.isPending) {
      schemaMutation.mutate(match.playbook.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, match?.playbook.id]);

  const publishMutation = useMutation({
    mutationFn: () =>
      publishFn({
        data: {
          playbookId: match!.playbook.id,
          name: missionName,
          objective: objective.trim() || null,
          proposal,
        },
      }),
    onSuccess: (mission) => {
      if (!mission) {
        setPublishError("La Mission n'a pas pu être créée.");
        return;
      }
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://metre-pro.com";
      setPublicUrl(`${origin}/m/${mission.public_token}`);
      setPublishError(null);
    },
    onError: (err: unknown) =>
      setPublishError(err instanceof Error ? err.message : "Publication impossible."),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Onboarding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créer une Mission à partir du site du client — sans construire de Playbook depuis zéro.
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {STEP_ORDER.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-2.5 py-1 ${
              s === step ? "border-primary bg-primary/10 font-medium text-primary" : "border-border"
            }`}
          >
            {i + 1}. {STEP_LABELS[s]}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-card p-6">
        {step === "url" && (
          <UrlStep
            url={url}
            onUrlChange={setUrl}
            onAnalyze={() => analyzeMutation.mutate()}
            analyzing={analyzeMutation.isPending}
            error={analyzeError}
          />
        )}

        {step === "businessType" && (
          <SingleChoiceConfirmStep
            title="Métier détecté"
            description="Confirme le métier principal du client, ou corrige-le si besoin."
            candidates={businessTypeCandidates}
            value={businessType}
            onValueChange={setBusinessType}
            onBack={() => setStep("url")}
            onConfirm={() => setStep("product")}
            noneDetectedMessage="Aucun métier n'a pu être détecté automatiquement sur ce site — merci de le préciser."
            confirmButtonLabel="Confirmer"
            backLabel="Retour"
            otherLabel="Autre (préciser)"
            otherOnlyLabel="Préciser"
            detectionLabels={{ detected: "Détecté automatiquement", notFound: "Non trouvé" }}
          />
        )}

        {step === "product" && (
          <SingleChoiceConfirmStep
            title="Produit ou service"
            description="Choisis le produit ou type de projet pour lequel créer un tunnel."
            candidates={products}
            value={product}
            onValueChange={(value) => {
              setProduct(value);
              if (!missionName) setMissionName(`${businessType} — ${value}`);
            }}
            onBack={() => setStep("businessType")}
            onConfirm={() => setStep("playbookMatch")}
            noneDetectedMessage="Aucun produit n'a pu être détecté automatiquement sur ce site — merci de le préciser."
            confirmButtonLabel="Confirmer"
            backLabel="Retour"
            otherLabel="Autre (préciser)"
            otherOnlyLabel="Préciser"
            detectionLabels={{ detected: "Détecté automatiquement", notFound: "Non trouvé" }}
          />
        )}

        {step === "playbookMatch" && (
          <PlaybookMatchStep
            businessType={businessType}
            product={product}
            match={match}
            onBack={() => setStep("product")}
            onContinue={() => setStep("customize")}
            title="Playbook associé"
            businessTypeLabel="Métier"
            productLabel="Produit"
            matchedLabel="Playbook proposé"
            backLabel="Retour"
            continueLabel="Continuer"
          />
        )}

        {step === "customize" && (
          <CustomizeStep
            missionName={missionName}
            onMissionNameChange={setMissionName}
            objective={objective}
            onObjectiveChange={setObjective}
            proposal={proposal}
            onProposalChange={(patch) => setProposal((prev) => ({ ...prev, ...patch }))}
            onBack={() => setStep("playbookMatch")}
            onContinue={() => setStep("preview")}
          />
        )}

        {step === "preview" && (
          <PreviewStep
            schema={schema}
            loading={schemaMutation.isPending || (!schema && !schemaMutation.isError)}
            missionName={missionName}
            playbookName={match?.playbook.name ?? ""}
            proposal={proposal}
            onBack={() => setStep("customize")}
            onContinue={() => setStep("publish")}
          />
        )}

        {step === "publish" && match && (
          <PublishStep
            missionName={missionName}
            playbookName={match.playbook.name}
            publicUrl={publicUrl}
            publishing={publishMutation.isPending}
            error={publishError}
            onBack={() => setStep("preview")}
            onPublish={() => publishMutation.mutate()}
          />
        )}
      </div>
    </div>
  );
}
