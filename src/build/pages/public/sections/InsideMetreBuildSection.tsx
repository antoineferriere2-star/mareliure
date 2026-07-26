import { useState } from "react";
import { SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { ProductShot } from "@/build/pages/public/ProductShot";
import { MissionsListPreview, DossiersListPreview } from "@/build/pages/public/AdminPreviewShots";
import { SingleChoiceConfirmStep } from "@/build/pages/admin/onboarding/SingleChoiceConfirmStep";
import { PlaybookMatchStep } from "@/build/pages/admin/onboarding/PlaybookMatchStep";
import {
  demoMissionsRows,
  demoDossiersRows,
  demoOnboarding,
} from "@/build/content/demoProductData";

function OnboardingPreview() {
  const [step, setStep] = useState<"business" | "match">("business");
  const [businessType, setBusinessType] = useState(demoOnboarding.businessType.value);

  if (step === "match") {
    return (
      <PlaybookMatchStep
        businessType={businessType}
        product={demoOnboarding.product.value}
        match={demoOnboarding.match}
        onBack={() => setStep("business")}
        onContinue={() => {}}
      />
    );
  }

  return (
    <SingleChoiceConfirmStep
      title="What kind of business is this?"
      description={`Detected from ${demoOnboarding.websiteUrl}.`}
      candidates={demoOnboarding.businessType.candidates}
      value={businessType}
      onValueChange={setBusinessType}
      onConfirm={() => setStep("match")}
      onBack={() => {}}
      noneDetectedMessage="No business type detected — pick one or describe it."
      confirmButtonLabel="Continue"
    />
  );
}

export function InsideMetreBuildSection() {
  return (
    <section className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Inside Métré Build"
          title="What your team sees, and how a Playbook gets set up in the first place."
        />
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <ProductShot
            title="Project Intakes at a glance"
            description="Every guided journey, its status and its Playbook in one list."
          >
            <MissionsListPreview rows={demoMissionsRows} />
          </ProductShot>
          <ProductShot
            title="Project Briefs ready to work"
            description="Confidence and missing information surfaced before the first call."
          >
            <DossiersListPreview rows={demoDossiersRows} />
          </ProductShot>
          <ProductShot
            title="Website setup in minutes"
            description="Point it at a business's website — the business type and a matching Playbook are proposed automatically."
          >
            <OnboardingPreview />
          </ProductShot>
        </div>
      </div>
    </section>
  );
}
