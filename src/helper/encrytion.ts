/**
 * Copyright by Sevenryze.
 */

// Import node.js libraries
import { Cipher, createCipheriv, createDecipheriv, Decipher, randomBytes } from "crypto";

// Import third-party libraries

// Import own libraries

/**********************************************************************************************************************/
export const CipherMethodList = {
  "aes-128-cfb": [16, 16],
  "aes-128-ofb": [16, 16],
  "aes-192-cfb": [24, 16],
  "aes-192-ofb": [24, 16],
  "aes-256-cfb": [32, 16],
  "aes-256-ofb": [32, 16],
  "bf-cfb": [16, 8],
  "camellia-128-cfb": [16, 16],
  "camellia-192-cfb": [24, 16],
  "camellia-256-cfb": [32, 16],
  "cast5-cfb": [16, 8],
  "des-cfb": [8, 8],
  "idea-cfb": [16, 8],
  "rc2-cfb": [16, 8],
  rc4: [16, 0],
  "rc4-md5": [16, 16],
  "seed-cfb": [16, 16]
};

const IVLengh = 16;
const key = Buffer.from("01234567012345670123456701234567");

export class Encrytion {
  private static iv;

  public static cipher: Cipher;
  public static decipher: Decipher;

  public static encrypt = (data: Buffer, key: string) => {
    Encrytion.iv = Encrytion.iv || randomBytes(IVLengh);
    let cipher = createCipheriv("aes-256-cbc", key, Encrytion.iv);
    let encrypted = cipher.update(data);

    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return {
      iv: Encrytion.iv,
      encrypted: encrypted
    };
  };

  public static decrypt = (data: Buffer, key: string): Buffer => {
    let decipher = createDecipheriv("aes-256-cbc", key, Encrytion.iv);

    let decrypted = decipher.update(data);

    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  };
}

export function encrypt(data: Buffer, key: string) {
  let iv = randomBytes(IVLengh);
  let cipher = createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(data);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return {
    iv: iv,
    encrypted: encrypted
  };
}

export function decrypt(data: Buffer) {}
