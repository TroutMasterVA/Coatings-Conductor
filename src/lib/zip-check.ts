/**
 * ZIP checks at project create (QA P3, Oct 30). "00000" is five digits but no US ZIP uses it, so
 * a job made with it could never load a forecast. Refuse it up front with a clear message.
 */
export const ZIP_00000_MESSAGE = "00000 isn't a US ZIP. Enter the job site's 5-digit ZIP.";

/** Message to show for a ZIP that is 5 digits but can't be real; null when it may be real. */
export function impossibleZip(zip: string): string | null {
  return zip === "00000" ? ZIP_00000_MESSAGE : null;
}
