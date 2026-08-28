export function validateProjectIdentity(input: { name: string; zip: string }): {
  name: string;
  zip: string;
} {
  const name = input.name.trim();
  const zip = input.zip.replace(/\D/g, "").slice(0, 5);
  if (!name) throw new Error("Project name is required.");
  if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
  return { name, zip };
}
