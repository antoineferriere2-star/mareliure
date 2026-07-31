// Site-wide "Questions?" launcher — a persistent, discoverable entry point
// to the same FAQ assistant as the homepage's FaqSection, for visitors who
// land on any other marketing page and don't want to scroll to the
// homepage footer. Deliberately NOT a chat-bubble icon or a general chat
// widget: a question-mark icon and "Questions?" label, opening a compact
// FAQ popover — same reasoning as the homepage FAQ itself (a chat pattern
// would blur the "this is not a chatbot" positioning and risk confusion
// with the actual Guided Project Intake). Never mounted on the intake flow
// (/m/:token) or the secure Project Summary page — see BuildPublicShell.tsx.
import { useState, type KeyboardEvent } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFaqAsk } from "@/build/pages/public/useFaqAsk";
import { STATIC_FAQ } from "@/build/pages/public/sections/FaqSection";

const QUICK_QUESTIONS = STATIC_FAQ.slice(0, 3);

export function FaqLauncher() {
  const { question, setQuestion, answer, loading, askQuestion, copy } = useFaqAsk();
  const [open, setOpen] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void askQuestion();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={copy("Questions?")}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-emerald-700 bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{copy("Questions?")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-[min(22rem,calc(100vw-2.5rem))] p-4">
        <p className="text-sm font-semibold text-slate-950">{copy("Have a question?")}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((item) => (
            <button
              key={item.question}
              type="button"
              onClick={() => setQuestion(item.question)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
            >
              {item.question}
            </button>
          ))}
        </div>

        <Textarea
          className="mt-3"
          rows={2}
          maxLength={500}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={copy("Type your question…")}
          aria-label={copy("Type your question…")}
        />
        <Button
          className="mt-2 w-full"
          onClick={() => void askQuestion()}
          disabled={loading || !question.trim()}
        >
          {loading ? copy("Asking…") : copy("Ask")}
        </Button>

        {answer && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            <p>{answer}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <a href="/contact" className="text-xs font-medium text-emerald-700 hover:underline">
                {copy("Talk to the team")}
              </a>
              <a href="/#faq" className="text-xs font-medium text-emerald-700 hover:underline">
                {copy("View full FAQ")}
              </a>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
