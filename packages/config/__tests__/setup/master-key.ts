import { openBase64MasterKey } from "../helpers/master-key";

// The suites run in env mode: the key MASTER_KEY names, opened as boot would open it.
const masterKey = process.env.MASTER_KEY;

if (!masterKey) throw new Error("The test config sets MASTER_KEY");
openBase64MasterKey(masterKey);
