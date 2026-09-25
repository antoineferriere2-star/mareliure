/**
 * « Photos d'exemple » : les réalisations de l'atelier, rangées par opération.
 * Elles sont proposées automatiquement quand l'opération entre dans un devis ;
 * le devis en reçoit une copie, qu'on peut retirer ligne par ligne.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Search, Trash2 } from "lucide-react";
import {
  deleteMyOperationPhoto,
  getMyOperationPhotos,
  updateMyOperationPhoto,
  uploadMyOperationPhoto,
} from "@/marketplace/services/binderQuotes.data.functions";
import type { BinderPricingCatalogItem } from "@/marketplace/pricing/binderPricingCatalog";
import {
  examplesFor,
  fileToBase64,
  QUOTE_OPERATION_PHOTO_MAX_BYTES,
  QUOTE_OPERATION_PHOTO_MAX_PER_LINE,
  QUOTE_OPERATION_PHOTO_MIME_TYPES,
  type OperationPhotoTarget,
  type OperationPhotoView,
} from "@/marketplace/quotes/quotePhotos";
import { normalizeSearch } from "@/marketplace/reference/search";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNote, FIELD } from "../quoteUi";
import { OPERATION_PHOTOS_KEY } from "../quoteQueryKeys";
import type { Service } from "./catalogTypes";

type Operation = { key: string; label: string; group: string; target: OperationPhotoTarget };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/45";

export function OperationPhotoLibrary({ items, services }: { items: readonly BinderPricingCatalogItem[]; services: readonly Service[] }) {
  const fetchPhotos = useServerFn(getMyOperationPhotos);
  const photos = useQuery({ queryKey: OPERATION_PHOTOS_KEY, queryFn: () => fetchPhotos() });
  const [search, setSearch] = useState("");
  const [onlyWithPhotos, setOnlyWithPhotos] = useState(false);

  const operations = useMemo<Operation[]>(() => [
    ...services.filter((service) => service.isActive).map((service) => ({ key: `service:${service.id}`, label: service.name, group: "Mes prestations", target: { serviceId: service.id } })),
    ...items.map((item) => ({ key: `base:${item.pricingKey}`, label: item.label, group: item.familyLabel, target: { pricingKey: item.pricingKey } })),
  ], [items, services]);

  if (photos.isPending) return <div role="status" className="space-y-3"><span className="sr-only">Chargement des photos…</span><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  if (photos.isError) return <ErrorNote>Vos photos d’exemple n’ont pas pu être chargées. Rechargez la page.</ErrorNote>;

  const library = photos.data;
  const needle = normalizeSearch(search);
  const visible = operations.filter((operation) =>
    (!needle || normalizeSearch(`${operation.label} ${operation.group}`).includes(needle))
    && (!onlyWithPhotos || examplesFor(operation.target, library).length > 0));
  const groups = [...new Set(visible.map((operation) => operation.group))].map((group) => ({ group, operations: visible.filter((operation) => operation.group === group) }));

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-[#7a2230] bg-[#fffdf8] px-5 py-4 text-sm leading-6 text-[#4b3829]">
        <p>Les 45 prestations sont illustrées par défaut. Ajoutez vos photos pour remplacer les illustrations proposées. Les nouveaux devis reprennent vos photos en priorité ; vous pouvez les retirer ou les exclure du PDF.</p>
        <p className="mt-1 text-xs text-[#685d51]">Illustrations fournies avec autorisation : Atelier Reliure Dorure Ferrière, Orléans. Elles ne représentent pas vos propres réalisations. Retirer toutes vos photos rétablit l’illustration par défaut ; les devis déjà enregistrés restent inchangés.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative sm:w-80">
          <span className="sr-only">Rechercher une opération</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#74695d]" />
          <input className={`${FIELD} pl-9`} placeholder="Demi-cuir, dorure, étui…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[#4b3829]">
          <input type="checkbox" checked={onlyWithPhotos} onChange={(event) => setOnlyWithPhotos(event.target.checked)} />
          Seulement les opérations illustrées ({operations.filter((operation) => examplesFor(operation.target, library).length > 0).length})
        </label>
      </div>
      {groups.length === 0 ? (
        <p className="border border-dashed border-[#bdb1a1] bg-[#fffdf8] px-6 py-10 text-center text-sm text-[#685d51]">{onlyWithPhotos && !needle ? "Aucune opération n’a encore de photo. Décochez le filtre pour en ajouter." : "Aucune opération ne correspond à cette recherche."}</p>
      ) : groups.map(({ group, operations: rows }) => (
        <section key={group} aria-label={group} className="space-y-2">
          <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#7a2230]">{group}</h3>
          <ul className="divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
            {rows.map((operation) => <OperationRow key={operation.key} operation={operation} photos={examplesFor(operation.target, library)} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function OperationRow({ operation, photos }: { operation: Operation; photos: OperationPhotoView[] }) {
  const queryClient = useQueryClient();
  const upload = useServerFn(uploadMyOperationPhoto);
  const [problem, setProblem] = useState<string | null>(null);
  const room = QUOTE_OPERATION_PHOTO_MAX_PER_LINE - photos.filter((photo) => !photo.isDefault).length;
  const add = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await upload({ data: { target: operation.target, mimeType: file.type as "image/jpeg" | "image/png", imageBase64: await fileToBase64(file), caption: null } });
      }
    },
    onError: () => setProblem("Certaines photos n’ont pas pu être ajoutées. Réessayez."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: OPERATION_PHOTOS_KEY }),
  });
  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const files = [...list];
    const accepted = files.filter((file) => QUOTE_OPERATION_PHOTO_MIME_TYPES.includes(file.type as never) && file.size <= QUOTE_OPERATION_PHOTO_MAX_BYTES).slice(0, Math.max(0, room));
    setProblem(accepted.length !== files.length ? `Maximum ${QUOTE_OPERATION_PHOTO_MAX_PER_LINE} photos JPEG ou PNG de 8 Mo par opération.` : null);
    if (accepted.length > 0) add.mutate(accepted);
  };

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#241a12]">{operation.label}</p>
          <p className="text-xs text-[#685d51]">{photos[0]?.isDefault ? "Illustration par défaut" : photos.length === 0 ? "Aucune photo" : `${photos.length} photo${photos.length > 1 ? "s" : ""} sur ${QUOTE_OPERATION_PHOTO_MAX_PER_LINE}`}</p>
        </div>
        {room > 0 && (
          <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[#cfc5b6] bg-white px-3 text-xs font-semibold hover:bg-[#f5f0e8] focus-within:ring-2 focus-within:ring-[#7a2230]/45 ${add.isPending ? "pointer-events-none opacity-60" : ""}`}>
            <Camera aria-hidden="true" className="mr-1 h-4 w-4" />
            {add.isPending ? "Envoi…" : photos[0]?.isDefault ? "Remplacer par mes photos" : "Ajouter des photos"}
            <span className="sr-only"> pour {operation.label}</span>
            <input type="file" accept="image/jpeg,image/png" multiple className="sr-only" disabled={add.isPending} onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
          </label>
        )}
      </div>
      {problem && <p role="alert" className="mt-2 text-xs text-[#9a3412]">{problem}</p>}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {photos.map((photo) => photo.isDefault ? <figure key={photo.id} className="overflow-hidden rounded-md border border-[#d8d0c4] bg-white"><img src={photo.url} alt={operation.label} loading="lazy" className="aspect-[4/3] w-full object-cover" /><figcaption className="p-2 text-xs text-muted-foreground">{photo.caption}</figcaption></figure> : <PhotoCard key={photo.id} photo={photo} operationLabel={operation.label} />)}
        </div>
      )}
    </li>
  );
}

function PhotoCard({ photo, operationLabel }: { photo: OperationPhotoView; operationLabel: string }) {
  const queryClient = useQueryClient();
  const rename = useServerFn(updateMyOperationPhoto);
  const remove = useServerFn(deleteMyOperationPhoto);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [confirming, setConfirming] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: OPERATION_PHOTOS_KEY });
  const saveCaption = useMutation({ mutationFn: () => rename({ data: { id: photo.id, caption: caption.trim() || null } }), onSuccess: refresh });
  const destroy = useMutation({ mutationFn: () => remove({ data: { id: photo.id } }), onSuccess: refresh });

  return (
    <figure className="overflow-hidden rounded-md border border-[#d8d0c4] bg-white">
      <img src={photo.url} alt={photo.caption || `Exemple de l’atelier : ${operationLabel}`} className="aspect-[4/3] w-full object-cover" />
      <div className="space-y-1 p-2">
        <input
          aria-label={`Légende — ${operationLabel}`}
          className={`${FIELD} h-9 text-xs`}
          placeholder="Légende (facultative)"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={() => { if (caption.trim() !== (photo.caption ?? "")) saveCaption.mutate(); }}
        />
        {saveCaption.isError && <p role="alert" className="text-[0.68rem] text-[#9a3412]">Légende non enregistrée.</p>}
        {confirming ? (
          <div className="flex flex-wrap gap-1">
            <button type="button" className={`min-h-9 rounded-sm bg-[#9a3412] px-2 text-[0.7rem] font-semibold text-white disabled:opacity-60 ${FOCUS}`} disabled={destroy.isPending} onClick={() => destroy.mutate()}>{destroy.isPending ? "Suppression…" : "Supprimer"}</button>
            <button type="button" className={`min-h-9 rounded-sm px-2 text-[0.7rem] font-semibold text-[#4b3829] underline ${FOCUS}`} onClick={() => setConfirming(false)}>Annuler</button>
          </div>
        ) : (
          <button type="button" className={`inline-flex min-h-9 items-center gap-1 rounded-sm text-[0.7rem] font-semibold text-[#9a3412] ${FOCUS}`} onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Retirer de mes exemples
          </button>
        )}
        {destroy.isError && <p role="alert" className="text-[0.68rem] text-[#9a3412]">La photo n’a pas pu être retirée.</p>}
      </div>
    </figure>
  );
}
