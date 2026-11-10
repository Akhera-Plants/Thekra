export type CorsOriginRule = string | RegExp;
export declare class CorsOriginsConfigError extends Error {
    constructor(entry: string, reason: string);
}
export declare function parseCorsOrigins(raw: string): CorsOriginRule[];
export declare function isAllowedCorsOrigin(rules: readonly CorsOriginRule[], origin: string | undefined): boolean;
export declare const PUBLIC_SITE_ORIGIN = "https://thekra-web.vercel.app";
export declare const BUILT_IN_CORS_ORIGINS: readonly string[];
export declare function corsOriginRules(raw: string | undefined): CorsOriginRule[];
