declare module "server-only";

declare module "heic-convert" {
  type HeicConvertInput = {
    buffer: ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  };

  export default function convert(input: HeicConvertInput): Promise<ArrayBuffer>;
}
