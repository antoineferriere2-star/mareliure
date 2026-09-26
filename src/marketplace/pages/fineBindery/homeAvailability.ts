import { listPublicFineBinderyProfiles } from "@/marketplace/services/fineBinderyProfile.data.functions";

/** Same published, approved profiles as the directory; rechecked by each route load. */
export async function loadFineBinderyHomeAvailability(): Promise<boolean> {
  try {
    return (await listPublicFineBinderyProfiles()).length > 0;
  } catch {
    // Keep the project path available without advertising an unverified directory.
    return false;
  }
}
