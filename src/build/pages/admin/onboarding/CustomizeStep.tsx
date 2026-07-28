import type { MissionProposal } from "@/build/schema/missionProposal";

export function CustomizeStep({
  missionName,
  onMissionNameChange,
  objective,
  onObjectiveChange,
  proposal,
  onProposalChange,
  onBack,
  onContinue,
}: {
  missionName: string;
  onMissionNameChange: (value: string) => void;
  objective: string;
  onObjectiveChange: (value: string) => void;
  proposal: MissionProposal;
  onProposalChange: (patch: Partial<MissionProposal>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Customization</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A few simple settings before previewing — nothing here changes the Playbook questions.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground">Title</label>
          <input
            value={missionName}
            onChange={(e) => onMissionNameChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground">Objective (internal, optional)</label>
          <input
            value={objective}
            onChange={(e) => onObjectiveChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground">Introduction shown to the visitor</label>
          <textarea
            value={proposal.intro ?? ""}
            onChange={(e) => onProposalChange({ intro: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Logo (URL)</label>
          <input
            value={proposal.logoUrl ?? ""}
            onChange={(e) => onProposalChange({ logoUrl: e.target.value || undefined })}
            placeholder="https://…/logo.png"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Color</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={proposal.brandColor ?? "#059669"}
              onChange={(e) => onProposalChange({ brandColor: e.target.value })}
              className="h-9 w-12 rounded border border-input bg-background"
            />
            <input
              value={proposal.brandColor ?? ""}
              onChange={(e) => onProposalChange({ brandColor: e.target.value || undefined })}
              placeholder="#059669"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground">Confirmation text</label>
          <textarea
            value={proposal.confirmationText ?? ""}
            onChange={(e) => onProposalChange({ confirmationText: e.target.value })}
            rows={2}
            placeholder="Thank you! We'll get back to you within 24 hours."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={proposal.hideOptionalFields ?? false}
            onChange={(e) => onProposalChange({ hideOptionalFields: e.target.checked })}
          />
          Hide optional questions from the visitor
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={missionName.trim().length < 2}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Preview
        </button>
      </div>
    </div>
  );
}
