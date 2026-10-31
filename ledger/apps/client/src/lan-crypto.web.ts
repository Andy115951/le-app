import { decode64, encode64, type LanCrypto } from "./lan-protocol";
const encoder = new TextEncoder();
export const lanCrypto: LanCrypto = {
  id: () => globalThis.crypto.randomUUID(),
  async seal(key, plaintext, aad) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const secret = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(key),
      "AES-GCM",
      false,
      ["encrypt"],
    );
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: encoder.encode(aad),
          tagLength: 128,
        },
        secret,
        encoder.encode(plaintext),
      ),
    );
    const output = new Uint8Array(iv.length + ciphertext.length);
    output.set(iv);
    output.set(ciphertext, iv.length);
    return encode64(output);
  },
  async open(key, envelope, aad) {
    const data = decode64(envelope);
    if (data.length < 28) throw new Error("加密内容无效");
    const secret = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(key),
      "AES-GCM",
      false,
      ["decrypt"],
    );
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: data.slice(0, 12),
          additionalData: encoder.encode(aad),
          tagLength: 128,
        },
        secret,
        data.slice(12),
      ),
    );
  },
};
