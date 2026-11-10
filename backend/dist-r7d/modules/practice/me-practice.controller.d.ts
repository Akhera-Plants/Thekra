import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PracticeChangesQueryDto } from './dto/practice-changes-query.dto.js';
import { PracticeSyncService } from './practice-sync.service.js';
export declare class MePracticeController {
    private readonly practiceSync;
    constructor(practiceSync: PracticeSyncService);
    changes(user: JwtPayload, query: PracticeChangesQueryDto): Promise<import("./practice-sync.js").PracticeChangesDto>;
    sync(user: JwtPayload, body: Record<string, unknown>): Promise<import("./practice-sync.js").PracticeChangesDto>;
}
