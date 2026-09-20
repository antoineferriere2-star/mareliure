/**
 * « Se déconnecter », avec l'adresse du compte ouvert à côté.
 *
 * Posé dans l'en-tête des trois espaces (client, atelier, back-office). Sans lui
 * un compte ouvert sur un appareil n'avait aucune sortie : `/auth` renvoie
 * aussitôt vers l'espace quiconque a une session. L'adresse affichée dit aussi
 * *quel* compte est ouvert — la question qu'on se pose avant de « changer de
 * profil ».
 *
 * Déconnexion sur cet appareil seulement (`scope: "local"`) : quitter le
 * navigateur du bureau ne doit pas fermer le téléphone.
 */
import { useNavigate, useRouteContext, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  performSignOut,
  purgeStoredSupabaseSession,
  supabaseProjectRef,
} from "@/marketplace/auth/signOut";

export function SignOutButton({
  label,
  signedInAs,
  className,
}: {
  /** « Se déconnecter » / « Sign out » — la langue de l'espace où le bouton est posé. */
  label: string;
  /** « Connecté en tant que » — lu par les lecteurs d'écran devant l'adresse. */
  signedInAs: string;
  /** Style du bouton, propre à chaque espace. */
  className?: string;
}) {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);
  const email = user.email ?? null;

  async function handleClick() {
    if (working) return;
    setWorking(true);
    try {
      await performSignOut({
        cancelQueries: () => queryClient.cancelQueries(),
        clearCache: () => queryClient.clear(),
        signOut: () => supabase.auth.signOut({ scope: "local" }),
        purgeLocalSession: () =>
          purgeStoredSupabaseSession(
            window.localStorage,
            supabaseProjectRef(String(import.meta.env.VITE_SUPABASE_URL ?? "")),
          ),
        invalidateRouter: () => router.invalidate(),
        goToSignIn: () => navigate({ to: "/auth", replace: true }),
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="hidden max-w-[16rem] truncate text-xs opacity-70 sm:inline" title={email}>
          <span className="sr-only">{signedInAs} </span>
          {email}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={working}
        className={
          className ??
          "inline-flex min-h-11 items-center rounded-md px-2 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        }
      >
        {label}
      </button>
    </div>
  );
}
