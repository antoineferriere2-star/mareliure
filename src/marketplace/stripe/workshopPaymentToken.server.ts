const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
async function key() {
  const value = process.env.WORKSHOP_PAYMENT_LINK_KEY;
  if (!value) throw new Error("workshop_payment_link_key_missing");
  let bytes = new Uint8Array();
  try {
    bytes = decode(value);
  } catch {
    throw new Error("workshop_payment_link_key_invalid");
  }
  if (bytes.byteLength !== 32) throw new Error("workshop_payment_link_key_invalid");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const context = (binderId: string, paymentId: string) =>
  new TextEncoder().encode(`workshop-payment-link:v1:${binderId}:${paymentId}`);
export async function sealWorkshopPaymentToken(token: string, binderId: string, paymentId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: context(binderId, paymentId) },
    await key(),
    new TextEncoder().encode(token),
  );
  return `v1.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
}
export async function openWorkshopPaymentToken(
  sealed: string,
  binderId: string,
  paymentId: string,
) {
  const [version, iv, ciphertext, extra] = sealed.split(".");
  if (version !== "v1" || !iv || !ciphertext || extra)
    throw new Error("workshop_payment_token_invalid");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(iv), additionalData: context(binderId, paymentId) },
    await key(),
    decode(ciphertext),
  );
  const token = new TextDecoder().decode(plaintext);
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("workshop_payment_token_invalid");
  return token;
}
