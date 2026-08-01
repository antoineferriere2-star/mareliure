// Shared ask-a-question logic for the homepage FAQ section and the
// site-wide FAQ launcher (FaqSection.tsx / FaqLauncher.tsx) — same
// endpoint, same stateless contract (no conversation history kept
// anywhere), just two different presentations of the same interaction.
import { useState } from "react";
import { publicCopy, usePublicLocale } from "@/build/pages/public/publicLocaleContext";

const GENERIC_ERROR_ANSWER =
  "We couldn't process that question — please try again or contact the team.";

export function useFaqAsk() {
  const { locale } = usePublicLocale();
  const copy = (text: string) => publicCopy(locale, text);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function askQuestion() {
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAnswer(null);
    setNotice(null);
    try {
      const res = await fetch("/api/public/faq-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, locale }),
      });
      if (!res.ok) {
        setAnswer(copy(GENERIC_ERROR_ANSWER));
        return;
      }
      const data = (await res.json()) as { answer: string; notice?: string | null };
      setAnswer(data.answer);
      setNotice(data.notice ?? null);
      // Clear the field once answered so the interface visibly invites a
      // follow-up question instead of looking like a one-shot form.
      setQuestion("");
    } catch {
      setAnswer(copy(GENERIC_ERROR_ANSWER));
    } finally {
      setLoading(false);
    }
  }

  return { question, setQuestion, answer, notice, loading, askQuestion, copy };
}
