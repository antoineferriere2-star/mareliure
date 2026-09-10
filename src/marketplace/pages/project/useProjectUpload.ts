/**
 * Envoyer une photo au fil d'un projet.
 *
 * Le serveur vérifie les droits et délivre une URL d'envoi à usage unique dans
 * le dossier du projet ; le fichier part ensuite directement vers le stockage
 * privé. Il ne sera rattaché à un message qu'après que le serveur a vérifié ce
 * que le stockage en dit. Ce qui est contrôlé ici — type, taille — l'est pour
 * répondre vite, pas pour protéger : la protection est côté serveur et bucket.
 */
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createProjectUploadUrl } from "@/marketplace/services/projectThread.functions";
import {
  PROJECT_FILE_MAX_BYTES,
  PROJECT_FILE_MIME_TYPES,
  type ProjectFileMimeType,
} from "@/marketplace/project/thread";

export const PROJECT_FILE_ACCEPT = PROJECT_FILE_MIME_TYPES.join(",");

const BY_EXTENSION: Record<string, ProjectFileMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

/** Certains téléphones n'annoncent pas le type d'une photo HEIC : on se fie alors à l'extension. */
function mimeTypeOf(file: File): ProjectFileMimeType | null {
  if ((PROJECT_FILE_MIME_TYPES as readonly string[]).includes(file.type))
    return file.type as ProjectFileMimeType;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[extension] ?? null;
}

export function useProjectUpload(caseId: string) {
  const createUrl = useServerFn(createProjectUploadUrl);

  return async function upload(files: readonly File[]): Promise<string[]> {
    const paths: string[] = [];
    for (const file of files) {
      const mimeType = mimeTypeOf(file);
      if (!mimeType)
        throw new Error(`« ${file.name} » : seules les photos et les PDF sont acceptés.`);
      if (file.size > PROJECT_FILE_MAX_BYTES) throw new Error(`« ${file.name} » dépasse 10 Mo.`);
      const target = await createUrl({ data: { caseId, mimeType, sizeBytes: file.size } });
      const { error } = await supabase.storage
        .from(target.bucket)
        .uploadToSignedUrl(target.path, target.token, file, { contentType: mimeType });
      if (error) throw new Error(`« ${file.name} » n'a pas pu être envoyé. Réessayez.`);
      paths.push(target.path);
    }
    return paths;
  };
}
