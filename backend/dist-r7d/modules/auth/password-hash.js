import { hash as argon2hash, argon2id } from 'argon2';
export const ARGON2_OPTIONS = {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
};
export const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export function hashPassword(password) {
    return argon2hash(password, ARGON2_OPTIONS);
}
//# sourceMappingURL=password-hash.js.map