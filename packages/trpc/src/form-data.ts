import { z } from "zod";

export interface UploadedFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FormDataValue = string | UploadedFile;

export interface FormDataInput {
  get(name: string): FormDataValue | null;
  forEach(callback: (value: FormDataValue, key: string) => void): void;
}

export const formDataInputSchema = z.custom<FormDataInput>((value) => value instanceof FormData);

export function isUploadedFile(value: FormDataValue | null): value is UploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    typeof value.arrayBuffer === "function"
  );
}

export function getUploadedFile(formData: FormDataInput, name: string): UploadedFile | null {
  const value = formData.get(name);

  return isUploadedFile(value) ? value : null;
}

export function getFormDataString(formData: FormDataInput, name: string): string | null {
  const value = formData.get(name);

  return typeof value === "string" ? value : null;
}
