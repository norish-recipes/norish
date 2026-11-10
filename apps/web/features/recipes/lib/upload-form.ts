/** An upload's fields as FormData, leaving out the ones not given. */
export function uploadForm(fields: Record<string, File | string | number | undefined>): FormData {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(name, typeof value === "number" ? String(value) : value);
  }

  return form;
}
