import { INestApplication } from '@nestjs/common';
export declare const JSON_BODY_LIMIT = "300kb";
export declare function parseTrustProxy(raw: string | undefined): boolean | number | string | undefined;
export declare function configureApp(app: INestApplication): void;
