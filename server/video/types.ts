export interface VideoMetadata {
  title: string;
  description: string;
  duration: number; // in seconds
  thumbnail: string;
  uploader?: string;
  uploadDate?: string;
}
