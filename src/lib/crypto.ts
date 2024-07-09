import crypto from "crypto"
import {Buffer} from "buffer"
import {DigestType, EncryptedMessage} from "../types";

export class CryptoModule {
    private _password: string;
    private _algo: string;
    private _salt: Buffer;
    private _iterations: number;
    private _digest: DigestType;

    constructor(password: string) {
        this._password = password;
        this._algo = 'aes-256-cbc';
        this._salt = crypto.randomBytes(16);

        /**
         * Select Iterations based on OWASP Cheat Sheet and your security needs:
         * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#pbkdf2
         *
         * Note: Stronger password is more efficient than increasing the iterations. Iterations increase CPU usage.
         */
        this._iterations = 100000;
        this._digest = 'sha256';  // Default is SHA256, No reason to upgrade to 512, because of compatibility and no security advantage
    }

    isEncrypted(body: any): boolean {
        return !!(body && typeof body === 'object' &&
            typeof body.encryptedData === 'string' &&
            typeof body.iv === 'string' &&
            typeof body.salt === 'string');

    }

    setPassword(password: string) {
        this._password = password;
    }

    _deriveKey(salt: Buffer): Buffer {
        return crypto.pbkdf2Sync(this._password, salt, this._iterations, 32, this._digest);
    }

    decrypt(encryptedMessage: EncryptedMessage) {
        const key = this._deriveKey(Buffer.from(encryptedMessage.salt, 'hex'));
        const iv = Buffer.from(encryptedMessage.iv, 'hex'),
            encryptedText = Buffer.from(encryptedMessage.encryptedData, 'hex'),
            decipher = crypto.createDecipheriv(this._algo, key, iv);
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }

    encrypt(text: string) {
        const key = this._deriveKey(this._salt),
            iv = crypto.randomBytes(16),  // Initialization vector must be 16 bytes
            cipher = crypto.createCipheriv(this._algo, key, iv);
        let encrypted = cipher.update(text);

        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return {
            iv: iv.toString('hex'),
            encryptedData: encrypted.toString('hex'),
            salt: this._salt.toString('hex')
        };
    }
}
