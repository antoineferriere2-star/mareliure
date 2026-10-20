import { Asset, HeadContent, useRouter, useRouterState, useTags } from "@tanstack/react-router";
import { isMaReliure } from "@/brand";

const MOBILE_PERFORMANCE_PAGES = new Set([
  "/",
  "/tarifs",
  "/reparation-de-livres",
  "/partenaires-relieurs",
  "/en",
]);

/** Laisse aux ressources du premier écran leur place avant les modules d'hydratation. */
export function PerformanceHead() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return isMaReliure && MOBILE_PERFORMANCE_PAGES.has(pathname) ? (
    <PublicAssetHead />
  ) : (
    <HeadContent />
  );
}

function PublicAssetHead() {
  const tags = useTags();
  const router = useRouter();
  const nonce = router.options.ssr?.nonce;
  const critical = (tag: (typeof tags)[number]) =>
    tag.tag === "link" &&
    tag.attrs?.rel === "preload" &&
    (tag.attrs.as === "font" || tag.attrs.as === "image");
  const hints = tags.filter(critical);
  const ordered = tags.filter((tag) => !critical(tag));
  const firstModule = ordered.findIndex(
    (tag) => tag.tag === "link" && tag.attrs?.rel === "modulepreload",
  );
  ordered.splice(firstModule < 0 ? ordered.length : firstModule, 0, ...hints);
  return (
    <>
      {ordered.map((tag) => {
        const asset =
          tag.tag === "link" && tag.attrs?.rel === "modulepreload"
            ? { ...tag, attrs: { ...tag.attrs, fetchPriority: "low" } }
            : tag;
        return <Asset {...asset} key={`tsr-meta-${JSON.stringify(tag)}`} nonce={nonce} />;
      })}
    </>
  );
}
