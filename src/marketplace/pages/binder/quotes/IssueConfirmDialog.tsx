/**
 * Dernier arrêt avant une pièce indélébile. Le refus est le choix par défaut : le focus arrive sur
 * « Revenir », et Échap ou Entrée ne peuvent donc rien émettre par mégarde.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function IssueConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details: readonly { label: string; value: string }[];
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="space-y-1 text-sm">
          {details.map((detail) => (
            <div key={detail.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{detail.label}</dt>
              <dd className="text-right font-medium tabular-nums">{detail.value}</dd>
            </div>
          ))}
        </dl>
        <AlertDialogFooter>
          <AlertDialogCancel>Revenir</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
