import { PushService } from './push.service.js';
export declare class PushController {
    private readonly push;
    constructor(push: PushService);
    config(): {
        enabled: boolean;
        publicKey: string | null;
    };
    deliver(signature: string | undefined, body: unknown): Promise<{
        outcome: string;
    }>;
    refill(authorization: string | undefined): Promise<{
        users: number;
        complete: boolean;
    }>;
}
