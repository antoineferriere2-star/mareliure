/** Photos are append-only and the SQL RPC serializes their eight-slot limit.
 * Never remove an object after an uncertain read or while a slot remains available.
 */
export async function associateLogisticsPhoto(
  id: string,
  associate: () => Promise<unknown>,
  readPhotos: () => Promise<readonly { id: string }[] | undefined>,
  removeUnassociated: () => Promise<void>,
): Promise<void> {
  try {
    await associate();
  } catch (error) {
    let photos: readonly { id: string }[] | undefined;
    try {
      photos = await readPhotos();
    } catch {
      throw error;
    }
    if (photos?.some((photo) => photo.id === id)) return;
    // A full immutable observation cannot subsequently associate this absent id.
    if (photos && photos.length >= 8) await removeUnassociated();
    throw error;
  }
}
