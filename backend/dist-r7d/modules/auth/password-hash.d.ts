import type { HashOptions } from 'argon2';
export declare const ARGON2_OPTIONS: HashOptions;
export declare const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export declare function hashPassword(password: string): Promise<string>;
