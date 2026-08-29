import { Button } from "@/components/ui/button";
import { publicCopy, useOptionalPublicLocale } from "@/build/pages/public/publicLocaleContext";

/** Shared "I'm not sure" toggle for scalar fields (text/number/measurement) that opt into it. */
export function NotSureToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: (nowNotSure: boolean) => void;
}) {
  const { locale } = useOptionalPublicLocale();
  const copy = (text: string) => publicCopy(locale, text);

  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="mt-3 rounded-full"
      onClick={() => onToggle(!active)}
    >
      {copy(active ? "Marked to clarify" : "I'm not sure yet")}
    </Button>
  );
}
