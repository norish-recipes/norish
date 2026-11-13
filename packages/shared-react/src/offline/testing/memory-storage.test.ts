import { File } from "node:buffer";

import { createMemoryStorage } from "./memory-storage";
import { describeOfflineStorageContract } from "./storage-contract";

describeOfflineStorageContract("memory", {
  create: createMemoryStorage,
  makeBlob: (text, name, type) => new File([text], name, { type }),
  readBlob: async (value) => {
    const file = value as File;

    return { text: await file.text(), name: file.name, type: file.type };
  },
});
