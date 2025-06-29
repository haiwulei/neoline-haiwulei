import WIF from 'wif';

import { ec } from 'elliptic';
import base58 from 'bs58';
import BN from 'bn.js';

import SHA256 from 'crypto-js/sha256';
import hexEncoding from 'crypto-js/enc-hex';
import { getLocalStorage } from '../common';
import { ethers } from 'ethers';
import { ChainType } from './constants';

const curve = new ec('p256');

const hexRegex = /^([0-9A-Fa-f]{2})*$/;

export const getMessageID = () => {
  const rand = Math.floor(Math.random() * 999999);
  const myDate = new Date();
  const messageId = myDate.getTime() + '' + rand;
  return messageId;
};

export function getPrivateKeyFromWIF(wif) {
  return ab2hexstring(WIF.decode(wif, 128).privateKey);
}

export function getPublicKeyFromPrivateKey(privateKey, encode = true) {
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  const keypair = curve.keyFromPrivate(privateKeyBuffer, 'hex');
  const unencodedPubKey = (keypair.getPublic() as any).encode('hex');
  if (encode) {
    const tail = parseInt(unencodedPubKey.substr(64 * 2, 2), 16);
    if (tail % 2 === 1) {
      return '03' + unencodedPubKey.substr(2, 64);
    } else {
      return '02' + unencodedPubKey.substr(2, 64);
    }
  } else {
    return unencodedPubKey;
  }
}

export function getScriptHashFromAddress(address) {
  const hash = ab2hexstring(base58.decode(address));
  return reverseHex(hash.substr(2, 40));
}

export function sign(hex, privateKey) {
  const msgHash = sha256(hex);
  const msgHashHex = Buffer.from(msgHash, 'hex');
  const privateKeyBuffer = Buffer.from(privateKey, 'hex');
  const sig = curve.sign(msgHashHex, privateKeyBuffer);
  return sig.r.toString('hex', 32) + sig.s.toString('hex', 32);
}

export function verify(hex, sig, publicKey) {
  if (!isPublicKey(publicKey, true)) {
    publicKey = getPublicKeyUnencoded(publicKey);
  }
  const sigObj = getSignatureFromHex(sig);
  const messageHash = sha256(hex);
  const publicKeyBuffer = Buffer.from(publicKey, 'hex');
  return curve.verify(messageHash, sigObj, publicKeyBuffer, 'hex');
}

/**
 * Converts signatureHex to a signature object with r & s.
 */
function getSignatureFromHex(signatureHex) {
  const signatureBuffer = Buffer.from(signatureHex, 'hex');
  const r = new BN(signatureBuffer.slice(0, 32).toString('hex'), 16, 'be');
  const s = new BN(signatureBuffer.slice(32).toString('hex'), 16, 'be');
  return { r, s };
}

export function reverseHex(hex) {
  ensureHex(hex);
  let out = '';
  for (let i = hex.length - 2; i >= 0; i -= 2) {
    out += hex.substr(i, 2);
  }
  return out;
}

export function ensureHex(str) {
  if (!isHex(str)) {
    throw new Error(`Expected a hexstring but got ${str}`);
  }
}

export function isHex(str) {
  try {
    return hexRegex.test(str);
  } catch (err) {
    return false;
  }
}

export function base64Encode(str) {
  var encode = encodeURI(str);
  var base64 = btoa(encode);
  return base64;
}

/**
 * Performs a single SHA256.
 */
export function sha256(hex) {
  return hash(hex, SHA256);
}

function hash(hex, hashingFunction) {
  const hexEncoded = hexEncoding.parse(hex);
  const result = hashingFunction(hexEncoded);
  return result.toString(hexEncoding);
}

/**
 * @param str ASCII string
 * @returns
 */
export function str2ab(str) {
  if (typeof str !== 'string') {
    throw new Error(`str2ab expected a string but got ${typeof str} instead.`);
  }
  const result = new Uint8Array(str.length);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    result[i] = str.charCodeAt(i);
  }
  return result;
}

/**
 * @param arr
 * @returns HEX string
 */
export function ab2hexstring(arr) {
  if (typeof arr !== 'object') {
    throw new Error(`ab2hexstring expects an array. Input was ${arr}`);
  }
  let result = '';
  const intArray = new Uint8Array(arr);
  for (const i of intArray) {
    let str = i.toString(16);
    str = str.length === 0 ? '00' : str.length === 1 ? '0' + str : str;
    result += str;
  }
  return result;
}

/**
 * @param str ASCII string
 * @returns HEX string
 */
export function str2hexstring(str) {
  return ab2hexstring(str2ab(str));
}

/**
 * @param str HEX string
// tslint:disable-next-line: jsdoc-format
// tslint:disable-next-line: jsdoc-format
// tslint:disable-next-line: no-redundant-jsdoc
 * @returns
 */
export function hexstring2ab(str) {
  ensureHex(str);
  if (!str.length) {
    return new Uint8Array(0);
  }
  const iters = str.length / 2;
  const result = new Uint8Array(iters);
  for (let i = 0; i < iters; i++) {
    result[i] = parseInt(str.substring(0, 2), 16);
    str = str.substring(2);
  }
  return result;
}

export function hexstring2str(hexstring) {
  return ab2str(hexstring2ab(hexstring));
}

/**
 * @param buf ArrayBuffer
 * @returns ASCII string
 */
export function ab2str(buf) {
  return String.fromCharCode.apply(null, Array.from(new Uint8Array(buf)));
}

/**
 * Encodes a public key.
 * @param unencodedKey unencoded public key
 * @return encoded public key
 */
export function getPublicKeyEncoded(unencodedKey) {
  const publicKeyArray = new Uint8Array(hexstring2ab(unencodedKey));
  if (publicKeyArray[64] % 2 === 1) {
    return '03' + ab2hexstring(publicKeyArray.slice(1, 33));
  } else {
    return '02' + ab2hexstring(publicKeyArray.slice(1, 33));
  }
}

/**
 * Unencodes a public key.
 * @param  publicKey Encoded public key
 * @return decoded public key
 */
export function getPublicKeyUnencoded(publicKey) {
  const publicKeyBuffer = Buffer.from(publicKey, 'hex');
  const keyPair = curve.keyFromPublic(publicKeyBuffer, 'hex');
  return keyPair.getPublic().encode('hex', true);
}

/**
 * Checks if hexstring is a valid Public Key. Accepts both encoded and unencoded forms.
 * @param key
 * @param  encoded Optional parameter to specify for a specific form. If this is omitted,
 * this function will return true for both forms. If this parameter is provided, this function will only return true for the specific form.
 */
export function isPublicKey(key, encoded) {
  try {
    let encodedKey;
    switch (key.substr(0, 2)) {
      case '04':
        if (encoded === true) {
          return false;
        }
        // Encode key
        encodedKey = getPublicKeyEncoded(key);
        break;
      case '02':
      case '03':
        if (encoded === false) {
          return false;
        }
        encodedKey = key;
        break;
      default:
        return false;
    }
    const unencoded = getPublicKeyUnencoded(encodedKey);
    const tail = parseInt(
      (unencoded as any).substr(unencoded.length - 2, 2),
      16
    );
    if (encodedKey.substr(0, 2) === '02' && tail % 2 === 0) {
      return true;
    }
    if (encodedKey.substr(0, 2) === '03' && tail % 2 === 1) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

export function getWalletType() {
  return new Promise<ChainType>((resolve, reject) => {
    getLocalStorage('wallet', (wallet) => {
      let currChainType = ChainType.Neo2;
      if (wallet && isN3Address(wallet.accounts[0].address, 53)) {
        currChainType = ChainType.Neo3;
      }
      if (ethers.isAddress(wallet.accounts[0].address)) {
        currChainType = ChainType.NeoX;
      }
      resolve(currChainType);
    }).catch((err) => reject(err));
  });
}

/**
 * Verifies an address using its checksum. Note that this does not check the address version to be equal to the one in the network.
 * If you wish to verify the exact address version, pass the version number to verifyAddressVersion.
 *
 * @param address - Base58 address
 * @param verifyAddressVersion - address version to verify against. If set, this will return false if the address version does not match.
 *
 * @example
 * isAddress("not an address"); // false
 * isAddress("NQ9NEvVrutLL6JDtUMKMrkEG6QpWNxgNBM"); // true
 * isAddress("ALq7AWrhAueN6mJNqk6FHJjnsEoPRytLdW"); // true
 *
 * isAddress("NQ9NEvVrutLL6JDtUMKMrkEG6QpWNxgNBM", 17); // false
 * isAddress("ALq7AWrhAueN6mJNqk6FHJjnsEoPRytLdW", 17); // true
 *
 * isAddress("NQ9NEvVrutLL6JDtUMKMrkEG6QpWNxgNBM", 35); // true
 * isAddress("ALq7AWrhAueN6mJNqk6FHJjnsEoPRytLdW", 35); // false
 */
export function isN3Address(address, verifyAddressVersion = -1) {
  try {
    const programHash = ab2hexstring(base58.decode(address));
    const givenAddressVersion = parseInt(programHash.slice(0, 2), 16);
    if (
      verifyAddressVersion >= 0 &&
      givenAddressVersion !== verifyAddressVersion
    ) {
      // Address might have come from a different network such as Neo Legacy.
      return false;
    }
    const shaChecksum = hash256(programHash.slice(0, 42)).slice(0, 8);
    // We use the checksum to verify the address
    if (shaChecksum !== programHash.slice(42, 42 + 8)) {
      return false;
    }
    // As other chains use similar checksum methods, we need to attempt to transform the programHash back into the address
    const scriptHash = reverseHex(programHash.slice(2, 42));
    if (
      getN3AddressFromScriptHash(scriptHash, givenAddressVersion) !== address
    ) {
      // address is not valid Neo address, could be btc, ltc etc.
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function hash256(hex) {
  const firstSha = sha256(hex);
  return sha256(firstSha);
}

/**
 * Converts a scripthash to address.
 */
const DEFAULT_ADDRESS_VERSION = 53;
export function getN3AddressFromScriptHash(
  scriptHash,
  addressVersion = DEFAULT_ADDRESS_VERSION
) {
  scriptHash = reverseHex(scriptHash);
  const addressVersionHex = addressVersion.toString(16);
  const shaChecksum = hash256(addressVersionHex + scriptHash).substr(0, 8);
  return base58.encode(
    Buffer.from(addressVersionHex + scriptHash + shaChecksum, 'hex')
  );
}
