// zustand persist için IndexedDB depolaması (idb-keyval). Tarayıcı IndexedDB'yi
// engellerse (gizli sekme vb.) bellekte çalışmaya devam eder.
import { createStore, del, get, set, clear } from "idb-keyval";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

const store = typeof indexedDB !== "undefined" ? createStore("rota-turkiye", "state") : undefined;
const memory = new Map<string, string>();

const idbStateStorage: StateStorage = {
  async getItem(name) {
    if (!store) return memory.get(name) ?? null;
    try {
      return ((await get<string>(name, store)) ?? null) as string | null;
    } catch {
      return memory.get(name) ?? null;
    }
  },
  async setItem(name, value) {
    memory.set(name, value);
    if (!store) return;
    try {
      await set(name, value, store);
    } catch {
      /* bellekte kalır */
    }
  },
  async removeItem(name) {
    memory.delete(name);
    if (!store) return;
    try {
      await del(name, store);
    } catch {
      /* yok say */
    }
  },
};

export const idbStorage = createJSONStorage(() => idbStateStorage);

/** Bütün yerel verileri siler */
export async function clearAllData(): Promise<void> {
  memory.clear();
  if (store) await clear(store);
}
