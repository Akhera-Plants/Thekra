import { type JwtPayload } from '../../common/decorators/current-user.decorator.js';
import { PushEndpointDto, PushSubscriptionDto, PushTestDto } from './dto/push-subscription.dto.js';
import { PushService } from './push.service.js';
export declare class MePushController {
    private readonly push;
    constructor(push: PushService);
    subscribe(user: JwtPayload, dto: PushSubscriptionDto): Promise<{
        id: string;
        scheduled: number;
    }>;
    unsubscribe(user: JwtPayload, dto: PushEndpointDto): Promise<void>;
    test(user: JwtPayload, dto: PushTestDto): Promise<void>;
}
