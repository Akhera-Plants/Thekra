export declare const SIN_VAULT_KDF = "pbkdf2-sha256";
export declare const SIN_VAULT_MIN_ITERATIONS = 210000;
export declare const SIN_VAULT_MAX_ITERATIONS = 5000000;
export declare const SIN_VAULT_MAX_CIPHERTEXT_BYTES: number;
export declare class PutSinVaultDto {
    ciphertext: string;
    iv: string;
    salt: string;
    kdf: string;
    iterations: number;
    version: number;
}
