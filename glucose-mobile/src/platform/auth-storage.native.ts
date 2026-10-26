import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { chunkedStorage } from "../core/session-storage";

export const authStorage = chunkedStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: key => SecureStore.deleteItemAsync(key),
}, randomUUID);
