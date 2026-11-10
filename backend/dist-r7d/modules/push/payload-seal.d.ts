export declare function sealKey(vapidPrivateKey: string): Buffer;
export declare function seal(value: unknown, key: Buffer): string;
export declare function open(sealed: string, key: Buffer): unknown;
