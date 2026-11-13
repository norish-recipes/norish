import { Directory, File, Paths } from "expo-file-system";

import type { UploadFileStore } from "./mmkv-storage";

/** Outbox upload copies in the app's documents, which the system never evicts. */
const uploadsDirectory = () => new Directory(Paths.document, "outbox-uploads");

export const uploadFiles: UploadFileStore = {
  async copy(from, name) {
    const directory = uploadsDirectory();

    directory.create({ idempotent: true, intermediates: true });
    await new File(from).copy(new File(directory, name), { overwrite: true });
  },
  uri: (name) => new File(uploadsDirectory(), name).uri,
  delete(name) {
    const file = new File(uploadsDirectory(), name);

    if (file.exists) {
      file.delete();
    }
  },
};
