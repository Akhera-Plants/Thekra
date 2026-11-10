import { PrismaService } from '../prisma/prisma.service.js';
export declare class HealthController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    liveness(): {
        status: string;
        uptime: number;
        version: string;
    };
    readiness(): Promise<{
        status: string;
        checks: {
            database: string;
        };
    }>;
}
