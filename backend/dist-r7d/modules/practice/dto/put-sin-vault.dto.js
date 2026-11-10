var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsIn, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsStrictInt } from '../../../common/decorators/is-strict-int.decorator.js';
export const SIN_VAULT_KDF = 'pbkdf2-sha256';
export const SIN_VAULT_MIN_ITERATIONS = 210_000;
export const SIN_VAULT_MAX_ITERATIONS = 5_000_000;
export const SIN_VAULT_MAX_CIPHERTEXT_BYTES = 128 * 1024;
const MAX_CIPHERTEXT_BASE64 = Math.ceil(SIN_VAULT_MAX_CIPHERTEXT_BYTES / 3) * 4;
export class PutSinVaultDto {
    ciphertext;
    iv;
    salt;
    kdf;
    iterations;
    version;
}
__decorate([
    IsString(),
    MaxLength(MAX_CIPHERTEXT_BASE64 + 4096),
    __metadata("design:type", String)
], PutSinVaultDto.prototype, "ciphertext", void 0);
__decorate([
    IsString(),
    MaxLength(64),
    __metadata("design:type", String)
], PutSinVaultDto.prototype, "iv", void 0);
__decorate([
    IsString(),
    MaxLength(64),
    __metadata("design:type", String)
], PutSinVaultDto.prototype, "salt", void 0);
__decorate([
    IsIn([SIN_VAULT_KDF]),
    __metadata("design:type", String)
], PutSinVaultDto.prototype, "kdf", void 0);
__decorate([
    IsStrictInt(),
    Min(SIN_VAULT_MIN_ITERATIONS),
    Max(SIN_VAULT_MAX_ITERATIONS),
    __metadata("design:type", Number)
], PutSinVaultDto.prototype, "iterations", void 0);
__decorate([
    IsStrictInt(),
    Min(0),
    Max(2_000_000_000),
    __metadata("design:type", Number)
], PutSinVaultDto.prototype, "version", void 0);
//# sourceMappingURL=put-sin-vault.dto.js.map