const DB_NAME = "family-game-room-arcade";
const DB_VERSION = 1;
const STORE_NAME = "roms";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser storage is unavailable."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open arcade storage."));
  });
}

function withStore(mode, work) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;

    try {
      result = work(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Arcade storage transaction failed."));
    };
  }));
}

export function romIdForFile(fileName = "") {
  return String(fileName).trim().toLowerCase().replace(/\.zip$/i, "");
}

export async function saveRom(file, gameId = romIdForFile(file?.name)) {
  if (!file || !gameId) throw new Error("A ROM ZIP is required.");
  const record = {
    id: gameId,
    name: file.name || `${gameId}.zip`,
    type: file.type || "application/zip",
    size: file.size || 0,
    updatedAt: Date.now(),
    blob: file,
  };
  await withStore("readwrite", (store) => store.put(record));
  return record;
}

export async function loadRom(gameId) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(gameId);
    request.onsuccess = () => {
      const record = request.result || null;
      db.close();
      resolve(record);
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("Unable to load ROM."));
    };
  });
}

export async function listInstalledRoms() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const records = request.result || [];
      db.close();
      resolve(records.map(({ id, name, size, updatedAt }) => ({ id, name, size, updatedAt })));
    };
    request.onerror = () => {
      db.close();
      reject(request.error || new Error("Unable to list installed ROMs."));
    };
  });
}

export async function removeRom(gameId) {
  await withStore("readwrite", (store) => store.delete(gameId));
}
