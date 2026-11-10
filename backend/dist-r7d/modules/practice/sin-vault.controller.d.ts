import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PutSinVaultDto } from './dto/put-sin-vault.dto.js';
import { SinVaultService } from './sin-vault.service.js';
export declare class SinVaultController {
    private readonly sinVault;
    constructor(sinVault: SinVaultService);
    find(user: JwtPayload): Promise<{
        vault: import("./sin-vault.service.js").SinVaultDto | null;
    }>;
    save(user: JwtPayload, dto: PutSinVaultDto): Promise<{
        version: number;
    }>;
    remove(user: JwtPayload): Promise<void>;
}
