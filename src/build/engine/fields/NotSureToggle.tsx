import { Button } from "@/components/ui/button";

/** Shared "I'm not sure" toggle for scalar fields (text/number/measurement) that opt into it. */
export function NotSureToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: (nowNotSure: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      className="mt-2"
      onClick={() => onToggle(!active)}
    >
      I&rsquo;m not sure
    </Button>
  );
}
