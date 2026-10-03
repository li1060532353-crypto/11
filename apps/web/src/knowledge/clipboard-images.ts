export type UploadedImage = { id: string; originalName: string; mimeType?: string | undefined };
export type ImageInsertion = ((asset: UploadedImage) => void) & { cancel?: () => void };
export type ImageUpload = (file: File, insert?: ImageInsertion) => void;

export function clipboardImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []);
  if (!files.length) {
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }
  return files.filter((file) => file.type.startsWith('image/'));
}
