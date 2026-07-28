import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listBuildPublicRequests, REQUEST_STATUSES } from "@/build/services/requests.data.functions";

export const Route = createFileRoute("/_authenticated/build/requests/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Requests — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: RequestsPage,
});

type RequestType = "audit" | "private_beta";
type Status = (typeof REQUEST_STATUSES)[number];

function requesterLabel(payload: Record<string, unknown>): string {
  if (typeof payload.firstName === "string") {
    return `${payload.firstName} ${typeof payload.lastName === "string" ? payload.lastName : ""}`.trim();
  }
  if (typeof payload.name === "string") return payload.name;
  return "—";
}

function companyLabel(payload: Record<string, unknown>): string {
  return typeof payload.company === "string" ? payload.company : "—";
}

function RequestsPage() {
  const [type, setType] = useState<RequestType | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const fetchRequests = useServerFn(listBuildPublicRequests);

  const key = ["build-admin", "requests", type, status] as const;
  const { data: requests } = useQuery({
    queryKey: key,
    queryFn: () => fetchRequests({ data: { type: type || undefined, status: status || undefined } }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Requests submitted via marketing pages (free audit, private beta).
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as RequestType | "")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All types</option>
          <option value="audit">Audit</option>
          <option value="private_beta">Private beta</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status | "")}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No request matches these filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Requester</th>
                <th className="px-4 py-2 text-left">Company</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">AI Audit</th>
                <th className="px-4 py-2 text-left">Received</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const payload = (r.payload ?? {}) as Record<string, unknown>;
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-b-0 hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <Link
                        to="/build/requests/$id"
                        params={{ id: r.id }}
                        className="font-medium text-foreground hover:underline"
                      >
                        {requesterLabel(payload)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{companyLabel(payload)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.request_type}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.audit_analyzed_at ? "Done" : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
