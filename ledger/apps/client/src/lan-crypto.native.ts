import {
  AESEncryptionKey,
  AESSealedData,
  aesEncryptAsync,
  aesDecryptAsync,
  randomUUID,
} from "expo-crypto";
import { decode64, type LanCrypto } from "./lan-protocol";
export const lanCrypto: LanCrypto = {
  id: randomUUID,
  async seal(key, plaintext, aad) {
    const secret = await AESEncryptionKey.import(key);
    const sealed = await aesEncryptAsync(
      new TextEncoder().encode(plaintext),
      secret,
      { tagLength: 16, additionalData: new TextEncoder().encode(aad) },
    );
    return sealed.combined("base64");
  },
  async open(key, envelope, aad) {
    const secret = await AESEncryptionKey.import(key);
    const sealed = AESSealedData.fromCombined(decode64(envelope), {
      ivLength: 12,
      tagLength: 16,
    });
    return new TextDecoder().decode(
      await aesDecryptAsync(sealed, secret, {
        additionalData: new TextEncoder().encode(aad),
      }),
    );
  },
};
