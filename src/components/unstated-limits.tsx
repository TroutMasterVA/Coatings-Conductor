import { unstatedLimitFlags } from "../lib/limit-fields.ts";
import type { Environmentals } from "../lib/types.ts";

/** Every unstated limit, flagged "Not stated — check the sheet for …". Shared by the card and the weather panel. */
export function UnstatedLimits({ env, className }: { env: Environmentals; className?: string }) {
  const flags = unstatedLimitFlags(env);
  if (!flags.length) return null;
  return (
    <ul className={className ?? "mt-2 space-y-0.5 text-xs text-caution"} data-testid="unstated-limits">
      {flags.map((f) => (
        <li key={f}>{f}</li>
      ))}
    </ul>
  );
}
