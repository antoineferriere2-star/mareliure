// Homepage FAQ: a static, pre-written accordion (instant, free, no network
// call) covers the common objections. The free-text field only exists for
// the long tail — most visitors click a pre-written question instead of
// typing their own, which is also what keeps this affordable (see
// src/routes/api/public/faq-ask.ts for the rate limiting). Every AI-answered
// question is independent — no conversation history is kept anywhere.
import type { KeyboardEvent } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/build/pages/public/BuildPublicShell";
import { useFaqAsk } from "@/build/pages/public/useFaqAsk";

interface StaticFaqEntry {
  question: string;
  answer: string;
}

export const STATIC_FAQ: StaticFaqEntry[] = [
  {
    question: "Is this a chatbot?",
    answer:
      "No. It's a structured qualification journey, not a generic chat. It's built to turn a vague inquiry into a Project Brief your team can act on before the first call.",
  },
  {
    question: "Can it give my customers a final price?",
    answer:
      "No. You stay the decision maker on pricing. Métré Build collects budget range, dimensions and context so your team can prepare — not a final quote or technical approval.",
  },
  {
    question: "We already have a contact form — why do we need this?",
    answer:
      "A form collects a message. Métré Build structures the project: it flags what's missing and hands your team a Project Brief with the source of every answer.",
  },
  {
    question: "We already use Typeform — how is this different?",
    answer:
      "Typeform is great for building forms. Métré Build adds business logic on top: a reusable Playbook, rules, controlled assumptions, and a structured Brief — not just a form builder.",
  },
  {
    question: "Will customers actually fill this out?",
    answer:
      'One focused question per screen, simple options, photos, and a "Not sure yet" answer whenever needed. Only the relevant questions show up for each visitor.',
  },
  {
    question: "Can the AI get it wrong?",
    answer:
      "Yes, and that's exactly why every answer is labeled by its source. Anything read from a photo is flagged as an observation to confirm, not a fact. You always keep the final call.",
  },
  {
    question: "Does it work with my CRM?",
    answer:
      "Project Briefs are available in your dashboard. Exports and integrations depend on your plan — happy to check what's available for the CRM you use.",
  },
  {
    question: "How long does it take to add to my site?",
    answer:
      "It depends on your website and the type of intake you need — a link or a small snippet either way. Happy to walk you through the exact steps for your setup.",
  },
];

export function FaqSection() {
  const { question, setQuestion, answer, notice, loading, askQuestion, copy } = useFaqAsk();

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void askQuestion();
    }
  }

  return (
    <section id="faq" className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeader eyebrow={copy("FAQ")} title={copy("Questions, answered")} />

        <Accordion
          type="single"
          collapsible
          className="mt-8 rounded-lg border border-slate-200 bg-white px-6"
        >
          {STATIC_FAQ.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
              <AccordionTrigger className="text-left text-[15px] font-semibold text-slate-950">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-6 text-slate-700">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <label htmlFor="faq-ask-input" className="text-sm font-medium text-slate-900">
            {copy("Don't see your question? Ask it here.")}
          </label>
          <Textarea
            id="faq-ask-input"
            className="mt-2"
            rows={2}
            maxLength={500}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={copy("Type your question…")}
          />
          <Button
            className="mt-3"
            onClick={() => void askQuestion()}
            disabled={loading || !question.trim()}
          >
            {loading ? copy("Asking…") : copy("Ask")}
          </Button>

          {answer && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <p>{answer}</p>
              {notice && <p className="mt-1 text-xs text-slate-500">{notice}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <a href="/contact" className="text-sm font-medium text-emerald-700 hover:underline">
                  {copy("Talk to the team")}
                </a>
                <span className="text-xs text-slate-500">
                  {copy("You can ask another question above.")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
