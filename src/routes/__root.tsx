import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {
  jsonLdScript,
  mareliureOrganizationSchema,
  mareliureWebsiteSchema,
  organizationSchema,
  websiteSchema,
} from "../lib/structured-data";
import { isMaReliure } from "../brand";

/**
 * Les valeurs par défaut du document, par marque.
 *
 * Elles étaient celles de Métré, sans condition. Une page Ma Reliure qui ne
 * redéfinissait pas son titre servait donc « Métré Build » dans l'onglet — ce
 * que voyait pendant tout le tunnel quelqu'un en train de confier son livre —
 * l'icône de Métré, et surtout des données structurées annonçant aux moteurs
 * que mareliure.fr *est* Métré Build, hébergé sur metre-pro.com.
 *
 * `isMaReliure` est une constante de compilation : la marque non déployée
 * disparaît du bundle plutôt que d'être évaluée à l'exécution.
 */
const BRAND = isMaReliure
  ? {
      lang: "fr",
      title: "Ma Reliure — Reliure et restauration de livres",
      description:
        "Confiez votre livre à un artisan relieur. Réparation, restauration, nouvelle reliure ou création : Ma Reliure évalue votre projet et le confie à l'atelier adapté, partout en France.",
      author: "Ma Reliure",
      icon: "/mareliure-icon.svg?v=20260909",
      // Porte les valeurs des tokens de surface du tunnel — voir styles.css.
      themeClass: "brand-mareliure",
      schemas: [mareliureOrganizationSchema, mareliureWebsiteSchema],
    }
  : {
      lang: "en",
      title: "Métré Build",
      description:
        "Métré Build turns vague website inquiries into structured Project Briefs your team can act on.",
      author: "Métré Build",
      icon: "/metre-icon.svg?v=20260727",
      themeClass: undefined,
      schemas: [organizationSchema, websiteSchema],
    };

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND.title },
      { name: "description", content: BRAND.description },
      { name: "author", content: BRAND.author },
      { property: "og:title", content: BRAND.title },
      { property: "og:description", content: BRAND.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // La vérification Search Console appartient à metre-pro.com. La servir
      // sur mareliure.fr ne vérifie rien et expose le jeton d'un autre domaine.
      ...(isMaReliure
        ? []
        : [
            {
              name: "google-site-verification",
              content: "rQrZLNB13JT3YhmVbAqqDsVfFzT4GTYRROIVrkahIB0",
            },
          ]),
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: BRAND.icon, type: "image/svg+xml" },
      { rel: "shortcut icon", href: BRAND.icon, type: "image/svg+xml" },
    ],
    scripts: BRAND.schemas.map(jsonLdScript),
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang={BRAND.lang} className={BRAND.themeClass}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
