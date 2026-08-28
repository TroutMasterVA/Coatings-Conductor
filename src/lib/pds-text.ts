export function validatePdsText(input: { text: string }): { text: string } {
  const text = (input?.text ?? "").trim();
  if (text.length < 40) throw new Error("PDS text is too short.");
  if (text.length > 40000) throw new Error("PDS text exceeds 40,000 characters.");
  return { text: text.slice(0, 24000) };
}
