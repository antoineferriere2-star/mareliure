/**
 * L'espace atelier ne s'ouvre qu'avec un mot de passe choisi (voir `workshopPassword.ts`).
 *
 * Le lien de connexion reçu par e-mail ouvre une session sans passer par l'écran de choix du mot de
 * passe de `/auth` : c'est ici, à l'entrée de l'espace, que l'atelier qui n'en a pas encore le
 * choisit. Le mot de passe est posé par `updateUser` sur cette session, celle qu'un lien ou un code
 * vient d'ouvrir — jamais sur un e-mail saisi.
 *
 * C'est une étape de parcours, pas une barrière de sécurité : les fonctions serveur de l'atelier
 * vérifient chacune la session et l'atelier, avec ou sans cet écran.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PASSWORD_MIN_LENGTH,
  hasChosenPassword,
  passwordTooShort,
  passwordUpdate,
} from "@/marketplace/auth/workshopPassword";
import type { FineBinderyLocale } from "@/marketplace/i18n/fineBinderyLocale";

const COPY: Record<FineBinderyLocale, { heading: string; body: string; label: string; button: string; tooShort: string; failed: string }> = {
  fr: {
    heading: "Choisissez votre mot de passe",
    body: "Il est obligatoire pour l'espace atelier : vous vous connecterez ensuite avec votre adresse e-mail et ce mot de passe. 8 caractères minimum.",
    label: "Mot de passe", button: "Enregistrer et ouvrir mon espace",
    tooShort: "Le mot de passe doit faire au moins 8 caractères.",
    failed: "Le mot de passe n'a pas pu être enregistré. Réessayez dans un instant.",
  },
  en: {
    heading: "Choose your password",
    body: "It is required for the workshop space: you will then sign in with your email address and this password. At least 8 characters.",
    label: "Password", button: "Save and open my space",
    tooShort: "The password must be at least 8 characters long.",
    failed: "The password could not be saved. Please try again in a moment.",
  },
  de: {
    heading: "Wählen Sie Ihr Passwort",
    body: "Für den Werkstattbereich ist es Pflicht: Sie melden sich danach mit Ihrer E-Mail-Adresse und diesem Passwort an. Mindestens 8 Zeichen.",
    label: "Passwort", button: "Speichern und Bereich öffnen",
    tooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    failed: "Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal.",
  },
  it: {
    heading: "Scegli la tua password",
    body: "È obbligatoria per lo spazio del laboratorio: accederai poi con il tuo indirizzo e-mail e questa password. Almeno 8 caratteri.",
    label: "Password", button: "Salva e apri il mio spazio",
    tooShort: "La password deve contenere almeno 8 caratteri.",
    failed: "Non è stato possibile salvare la password. Riprova tra un momento.",
  },
  es: {
    heading: "Elige tu contraseña",
    body: "Es obligatoria para el espacio del taller: después accederás con tu correo y esta contraseña. Mínimo 8 caracteres.",
    label: "Contraseña", button: "Guardar y abrir mi espacio",
    tooShort: "La contraseña debe tener al menos 8 caracteres.",
    failed: "No se pudo guardar la contraseña. Inténtalo de nuevo en un momento.",
  },
};

const USER_KEY = ["auth", "current-user"] as const;

export function WorkshopPasswordGate({ locale, children }: { locale: FineBinderyLocale; children: ReactNode }) {
  const queryClient = useQueryClient();
  const user = useQuery({
    queryKey: USER_KEY,
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  if (user.isPending) return null;
  // Sans session lisible, on laisse la route et le serveur répondre comme avant.
  if (!user.data || hasChosenPassword(user.data)) return <>{children}</>;
  return <ChoosePassword locale={locale} onDone={() => queryClient.invalidateQueries({ queryKey: USER_KEY })} />;
}

function ChoosePassword({ locale, onDone }: { locale: FineBinderyLocale; onDone: () => Promise<void> }) {
  const copy = COPY[locale] ?? COPY.fr;
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (passwordTooShort(password)) return setProblem(copy.tooShort);
    setSaving(true);
    setProblem(null);
    const { error } = await supabase.auth.updateUser(passwordUpdate(password));
    setSaving(false);
    if (error) return setProblem(copy.failed);
    await onDone();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4efe6] px-5 text-[#241a12]">
      <form onSubmit={submit} className="w-full max-w-md rounded-sm border border-[#d8d0c4] bg-[#fffdf8] p-7 shadow-sm">
        <h1 className="font-editorial text-2xl">{copy.heading}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5d5146]">{copy.body}</p>
        <label htmlFor="workshop-new-password" className="mt-6 block text-sm font-semibold">{copy.label}</label>
        <input
          id="workshop-new-password"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-sm border border-[#cfc5b6] bg-white px-3 py-3"
        />
        {problem && <p role="alert" className="mt-3 text-sm text-[#7a2230]">{problem}</p>}
        <button type="submit" disabled={saving} className="mt-6 w-full rounded-sm bg-[#241a12] px-5 py-3 text-sm font-semibold text-[#fbf8f2] disabled:opacity-60">
          {saving ? "…" : copy.button}
        </button>
      </form>
    </main>
  );
}
