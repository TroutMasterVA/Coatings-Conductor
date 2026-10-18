import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Loader2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CANCEL_LABEL,
  CLOSE_CONFIRM_TEXT,
  CLOSE_JOB_LABEL,
  closedBadgeText,
  type JobStatusView,
} from "@/lib/job-status";

/** "Close job" + confirm (CONTRACT closeout). Radix AlertDialog: focus moves in, Esc cancels, focus returns. */
export function CloseJobButton({
  onConfirm,
  closing,
  error,
  open,
  onOpenChange,
}: {
  onConfirm: () => void;
  closing: boolean;
  error: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(v) => (closing ? undefined : onOpenChange(v))}>
      <AlertDialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Lock />
          {CLOSE_JOB_LABEL}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <AlertDialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.10)] focus:outline-none"
        >
          <AlertDialog.Title className="text-base font-medium">
            {CLOSE_CONFIRM_TEXT}
          </AlertDialog.Title>
          {error ? (
            <p role="alert" className="mt-3 text-sm text-nogo">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="ghost" size="sm" disabled={closing}>
                {CANCEL_LABEL}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant="rail"
              size="sm"
              disabled={closing}
              aria-busy={closing}
              onClick={(e) => {
                // Stay open until the server answers; the parent closes the dialog on success.
                e.preventDefault();
                onConfirm();
              }}
            >
              {closing ? <Loader2 className="animate-spin" /> : null}
              {CLOSE_JOB_LABEL}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function ClosedBadge({ view, className }: { view: JobStatusView; className?: string }) {
  return (
    <Badge variant="paper" className={className} title="This job is closed and read-only.">
      {closedBadgeText(view)}
    </Badge>
  );
}
