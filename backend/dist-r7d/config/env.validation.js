var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync, } from 'class-validator';
export class EnvironmentVariables {
    DATABASE_URL;
    PORT = 3001;
    CORS_ORIGINS = 'http://localhost:3000';
    NODE_ENV = 'development';
    LOG_LEVEL = 'info';
    VARIETY_SCORE_FLOOR = 70;
    QURAN_PREFERRED_PROVIDER;
    ADMIN_API_KEY;
    SYNC_ENABLED = 'false';
    SYNC_STALE_AFTER_MINUTES = 120;
    SYNC_MAX_REQUESTS_PER_RUN = 2000;
    SYNC_MAX_DURATION_MINUTES = 30;
    SYNC_MAX_RECORD_FAILURES = 50;
    SYNC_QURAN_CRON;
    SYNC_HADITH_CRON;
    QURAN_API_TOKEN;
    QURAN_API_CLIENT_ID;
    QURAN_API_BASE_URL = 'https://api.quran.com/api/v4';
    QURAN_TRANSLATION_IDS = '131';
    QURAN_TEXT_FIELD = 'text_uthmani';
    SUNNAH_API_KEY;
    HADITH_API_KEY;
    JWT_ACCESS_SECRET = 'thekra-access-secret-change-in-production';
    JWT_REFRESH_SECRET = 'thekra-refresh-secret-change-in-production';
    ACCESS_TTL = '15m';
    REFRESH_TTL = '30d';
    TRUST_PROXY;
    VAPID_PUBLIC_KEY;
    VAPID_PRIVATE_KEY;
    VAPID_SUBJECT;
    PUSH_PUBLIC_API_URL;
    QSTASH_TOKEN;
    QSTASH_URL;
    QSTASH_CURRENT_SIGNING_KEY;
    QSTASH_NEXT_SIGNING_KEY;
    CRON_SECRET;
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "DATABASE_URL", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "PORT", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "CORS_ORIGINS", void 0);
__decorate([
    IsOptional(),
    IsIn(['development', 'test', 'production']),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "NODE_ENV", void 0);
__decorate([
    IsOptional(),
    IsIn(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "LOG_LEVEL", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(0),
    Max(100),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "VARIETY_SCORE_FLOOR", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QURAN_PREFERRED_PROVIDER", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "ADMIN_API_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "SYNC_ENABLED", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "SYNC_STALE_AFTER_MINUTES", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "SYNC_MAX_REQUESTS_PER_RUN", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "SYNC_MAX_DURATION_MINUTES", void 0);
__decorate([
    IsOptional(),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], EnvironmentVariables.prototype, "SYNC_MAX_RECORD_FAILURES", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "SYNC_QURAN_CRON", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "SYNC_HADITH_CRON", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QURAN_API_TOKEN", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QURAN_API_CLIENT_ID", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QURAN_API_BASE_URL", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QURAN_TRANSLATION_IDS", void 0);
__decorate([
    IsOptional(),
    IsIn(['text_uthmani', 'text_imlaei']),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QURAN_TEXT_FIELD", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "SUNNAH_API_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "HADITH_API_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "JWT_ACCESS_SECRET", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "JWT_REFRESH_SECRET", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "ACCESS_TTL", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "REFRESH_TTL", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "TRUST_PROXY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "VAPID_PUBLIC_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "VAPID_PRIVATE_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "VAPID_SUBJECT", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "PUSH_PUBLIC_API_URL", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QSTASH_TOKEN", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QSTASH_URL", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QSTASH_CURRENT_SIGNING_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "QSTASH_NEXT_SIGNING_KEY", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], EnvironmentVariables.prototype, "CRON_SECRET", void 0);
export function validateEnv(config) {
    const validated = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });
    const errors = validateSync(validated, { skipMissingProperties: false });
    if (errors.length > 0) {
        const messages = errors
            .map((error) => Object.values(error.constraints ?? {}).join(', '))
            .join('; ');
        throw new Error(`Invalid environment: ${messages}`);
    }
    if (validated.NODE_ENV === 'production') {
        assertProductionJwtSecrets(validated.JWT_ACCESS_SECRET, validated.JWT_REFRESH_SECRET);
    }
    return validated;
}
const DEFAULT_JWT_SECRETS = new Set([
    'thekra-access-secret-change-in-production',
    'thekra-refresh-secret-change-in-production',
]);
const MIN_JWT_SECRET_LENGTH = 32;
export function assertProductionJwtSecrets(access, refresh) {
    const problems = [];
    for (const [name, value] of [
        ['JWT_ACCESS_SECRET', access],
        ['JWT_REFRESH_SECRET', refresh],
    ]) {
        if (!value || DEFAULT_JWT_SECRETS.has(value)) {
            problems.push(`${name} must be set to a non-default value`);
        }
        else if (value.length < MIN_JWT_SECRET_LENGTH) {
            problems.push(`${name} must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
        }
    }
    if (access && access === refresh) {
        problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
    if (problems.length > 0) {
        throw new Error(`Invalid environment (production): ${problems.join('; ')}.`);
    }
}
//# sourceMappingURL=env.validation.js.map