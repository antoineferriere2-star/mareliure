import type { ReactNode } from "react";

export function AdminStub({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {children ?? "Module en cours de préparation. Le contenu sera branché ici."}
        </p>
      </div>
    </div>
  );
}
