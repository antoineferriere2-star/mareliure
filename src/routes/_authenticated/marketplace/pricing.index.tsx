import { createFileRoute } from "@tanstack/react-router";
import {
  CONSOLE_VIEWS,
  PricingConsolePage,
  type ConsoleView,
} from "@/marketplace/pages/admin/pricing/PricingConsolePage";

const VIEW_KEYS = CONSOLE_VIEWS.map((view) => view.key) as readonly string[];

export const Route = createFileRoute("/_authenticated/marketplace/pricing/")({
  validateSearch: (search: Record<string, unknown>): { view?: ConsoleView } => ({
    view: VIEW_KEYS.includes(String(search.view)) ? (search.view as ConsoleView) : undefined,
  }),
  component: PricingConsoleRoute,
});

function PricingConsoleRoute() {
  const { view } = Route.useSearch();
  return <PricingConsolePage view={view ?? "catalogue"} />;
}
