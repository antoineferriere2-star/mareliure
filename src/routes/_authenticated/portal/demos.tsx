// Métré Sales / Demos — the prospect list.
//
// Deliberately one screen and one table. Every action it offers already exists
// somewhere in the portal: the demo itself is built in /portal/setup, paused in
// /portal/missions, and its Project Briefs are read in /portal. What was
// missing was the answer to "which prospect is this demo for?", which is the
// only thing this page owns.
//
// Reachable only from an internal Sales workspace: the server refuses
// listProspectDemos on a customer workspace with a 404, and the nav does not
// link here.
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMyWorkspaces } from "@/build/services/portal.data.functions";
import {
  listProspectDemos,
  updateProspectDemo,
  type ProspectDemo,
} from "@/build/services/salesDemos.data.functions";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";
import { PROSPECT_STATUSES, type ProspectStatus } from "@/build/workspaces/internalSales";

export const Route = createFileRoute("/_authenticated/portal/demos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Prospect demos — Métré Sales" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalDemosPage,
});

const STATUS_CLASS: Record<ProspectStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  ready: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
  sent: "border-sky-600/30 bg-sky-600/10 text-sky-700",
  archived: "border-border bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<ProspectStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  sent: "Sent",
  archived: "Archived",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Absolute URL for the prospect, built in the browser: server code has no reliable origin. */
function demoUrl(path: string): string {
  return `${window.location.origin}${path}`;
}

function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(demoUrl(path));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked (permissions, insecure context): the link is
          // still visible and selectable in the row, so say nothing rather
          // than throw an error at someone mid-prospecting.
          setCopied(false);
        }
      }}
      className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function PortalDemosPage() {
  const queryClient = useQueryClient();
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const { data: workspaces } = useSuspenseQuery(
    queryOptions({ queryKey: ["portal", "workspaces"] as const, queryFn: () => fetchWorkspaces() }),
  );
  const salesWorkspaces = workspaces.filter((w) => w.isInternalSales);
  const [workspaceId, setWorkspaceId] = useState<string>(salesWorkspaces[0]?.id ?? "");
  const isOwner = salesWorkspaces.find((w) => w.id === workspaceId)?.role === "owner";

  const demosKey = ["portal", "demos", workspaceId] as const;
  const fetchDemos = useServerFn(listProspectDemos);
  const {
    data: demos,
    isPending,
    error,
  } = useQuery({
    queryKey: demosKey,
    queryFn: () => fetchDemos({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });

  const update = useServerFn(updateProspectDemo);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateMutation = useMutation({
    mutationFn: (vars: { demoId: string; companyName?: string | null; status?: ProspectStatus }) =>
      update({ data: { workspaceId, ...vars } }),
    onSuccess: () => {
      setUpdateError(null);
      queryClient.invalidateQueries({ queryKey: demosKey });
    },
    onError: (err: unknown) => {
      setUpdateError(err instanceof Error ? err.message : "Unable to update this demo.");
    },
  });

  if (salesWorkspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          This account has no internal Sales workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Prospect demos</h1>
          <p className="text-sm text-muted-foreground">
            One demo per prospect. Build a new one from a prospect&apos;s website in Setup, then
            copy its link here.
          </p>
        </div>
        <Link
          to="/portal/setup"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New demo
        </Link>
      </header>

      {salesWorkspaces.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Workspace</span>
          <select
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {salesWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {updateError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {updateError}
        </p>
      )}

      {isPending && <PortalPending />}
      {error && <PortalError error={error as Error} />}

      {demos && demos.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No demo yet. Start one from a prospect&apos;s website address in Setup.
          </p>
        </div>
      )}

      {demos && demos.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Prospect</th>
                <th className="px-4 py-3 font-medium">Website</th>
                <th className="px-4 py-3 font-medium">Demo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demos.map((demo) => (
                <DemoRow
                  key={demo.id}
                  demo={demo}
                  readOnly={!isOwner}
                  onUpdate={(fields) => updateMutation.mutate({ demoId: demo.id, ...fields })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DemoRow({
  demo,
  readOnly,
  onUpdate,
}: {
  demo: ProspectDemo;
  readOnly: boolean;
  onUpdate: (fields: { companyName?: string | null; status?: ProspectStatus }) => void;
}) {
  const [name, setName] = useState(demo.companyName ?? "");

  return (
    <tr className="border-b border-border last:border-0 align-top">
      <td className="px-4 py-3">
        {readOnly ? (
          <span className="font-medium text-foreground">{demo.prospectName}</span>
        ) : (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim() !== (demo.companyName ?? "")) onUpdate({ companyName: name });
            }}
            placeholder={demo.prospectName}
            aria-label="Prospect company name"
            className="w-40 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-input focus:border-input focus:outline-none"
          />
        )}
        {demo.detectedBusinessType && (
          <p className="mt-0.5 text-xs text-muted-foreground">{demo.detectedBusinessType}</p>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {demo.websiteUrl ? (
          <a
            href={demo.websiteUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {demo.domain ?? demo.websiteUrl}
          </a>
        ) : (
          <span>—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {demo.publicPath ? (
          <>
            <a
              href={demo.publicPath}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              Open demo
            </a>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {demo.funnel.viewed} viewed · {demo.funnel.started} started · {demo.funnel.completed}{" "}
              completed · {demo.funnel.briefs} briefs
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">Not published</span>
        )}
        {demo.missionStatus === "paused" && (
          <p className="mt-0.5 text-xs text-amber-700">
            Paused — the link no longer accepts answers
          </p>
        )}
      </td>
      <td className="px-4 py-3">
        {readOnly ? (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[demo.status]}`}
          >
            {STATUS_LABEL[demo.status]}
          </span>
        ) : (
          <select
            value={demo.status}
            onChange={(event) => onUpdate({ status: event.target.value as ProspectStatus })}
            aria-label="Demo status"
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[demo.status]}`}
          >
            {PROSPECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(demo.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {demo.publicPath && <CopyLinkButton path={demo.publicPath} />}
          <Link
            to="/portal/missions"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            Publish / pause
          </Link>
        </div>
      </td>
    </tr>
  );
}
