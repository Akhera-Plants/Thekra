export class ProviderHttpError extends Error {
    statusCode;
    retryAfterMs;
    constructor(statusCode, message, retryAfterMs) {
        super(message);
        this.statusCode = statusCode;
        this.retryAfterMs = retryAfterMs;
        this.name = 'ProviderHttpError';
    }
}
export class SkipRecordError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SkipRecordError';
    }
}
export class RunAbortedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RunAbortedError';
    }
}
export const CONTENT_PROVIDERS_TOKEN = 'CONTENT_PROVIDERS';
//# sourceMappingURL=content-provider.interface.js.map