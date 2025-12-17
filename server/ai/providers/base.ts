/**
 * Input for AI vision models - represents an image to process
 */
export interface ImageInput {
  data: string; // base64 encoded
  mimeType: string;
}

export interface AIProvider {
  name: string;

  generateStructuredOutput<T>(
    prompt: string,
    schema: any,
    systemMessage?: string
  ): Promise<T | null>;

  /**
   * Generate structured output from images using vision models.
   */
  generateFromImages<T>(
    images: ImageInput[],
    prompt: string,
    schema: any,
    systemMessage?: string
  ): Promise<T | null>;
}

