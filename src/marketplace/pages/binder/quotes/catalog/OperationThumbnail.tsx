import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyOperationPhotos } from "@/marketplace/services/binderQuotes.data.functions";
import { examplesFor } from "@/marketplace/quotes/quotePhotos";
import { OPERATION_PHOTOS_KEY } from "../quoteQueryKeys";

export function OperationThumbnail({ pricingKey, label }: { pricingKey: string; label: string }) {
  const fetchPhotos = useServerFn(getMyOperationPhotos);
  const photos = useQuery({ queryKey: OPERATION_PHOTOS_KEY, queryFn: () => fetchPhotos() });
  const photo = photos.isSuccess ? examplesFor({ pricingKey }, photos.data)[0] : null;
  return photo ? <img src={photo.url} alt={label} title={photo.caption ?? label} loading="lazy" className="h-12 w-12 shrink-0 rounded-md object-cover" /> : null;
}
