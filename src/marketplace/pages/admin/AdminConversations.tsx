/**
 * Les conversations d'un dossier, vues par l'équipe (le concierge) — Phase 0 / P1-6.
 *
 * Aucun nouveau système de messagerie : c'est le `ConversationPanel` existant, fixé sur un canal à la fois
 * (`messaging/adminChannels.ts`). Le serveur reste seul juge de ce que chacun lit et de l'audience d'un message :
 * le client et l'atelier retenu ne partagent jamais un fil, et le client ne voit jamais le canal atelier.
 */
import { ConversationPanel } from "@/marketplace/pages/ConversationPanel";
import { adminChannelsFor } from "@/marketplace/messaging/adminChannels";

export function AdminConversations({
  caseId,
  brand,
  workshopSelected,
}: {
  caseId: string;
  brand: string;
  workshopSelected: boolean;
}) {
  return (
    <div className="space-y-6">
      {adminChannelsFor(brand).map((channel) => {
        // Le canal atelier n'a d'interlocuteur qu'une fois un atelier retenu.
        if (channel.audience === "workshop_platform" && !workshopSelected) {
          return (
            <section key={channel.audience} className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-serif text-lg">{channel.heading}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aucun atelier retenu : ce canal s'ouvre dès qu'un atelier est retenu pour ce dossier.
              </p>
            </section>
          );
        }
        return (
          <div key={channel.audience}>
            <ConversationPanel caseId={caseId} viewerRole="admin" audience={channel.audience} heading={channel.heading} />
            <p className="mt-2 text-xs text-muted-foreground">{channel.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
