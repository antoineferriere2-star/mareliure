import { z } from "zod";
import { parcelInput, receptionInput } from "@/marketplace/shipping/logisticsPlan";
export const workshopParcelPlan = z.object({ fromAddress: receptionInput, toAddress: receptionInput, parcel: parcelInput }).strict();
export type WorkshopParcelPlan = z.infer<typeof workshopParcelPlan>;
export const workshopTransportOptionsInput = workshopParcelPlan.extend({ workId: z.string().uuid(), invoiceId: z.string().uuid() }).strict();
