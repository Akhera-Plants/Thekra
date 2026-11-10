export declare class PushPrefsDto {
    habits?: boolean;
    periodic?: boolean;
    periodicTime?: string;
    eveningNudge?: boolean;
    eveningTime?: string;
    fridayReview?: boolean;
    fridayTime?: string;
    reviewDay?: number;
    occasions?: boolean;
    occasionTime?: string;
    strategies?: string[];
    strategyTime?: string;
    strategyDay?: number;
    intentionReminder?: boolean;
    intentionTime?: string;
    mutedPlans?: string[];
    mutedActs?: string[];
    anchorTimes?: Record<string, Record<string, string>>;
}
export declare class PushKeysDto {
    p256dh: string;
    auth: string;
}
export declare class PushSubscriptionDto {
    endpoint: string;
    keys: PushKeysDto;
    timeZone: string;
    locale: 'ar' | 'en';
    prefs?: PushPrefsDto;
}
export declare class PushEndpointDto {
    endpoint: string;
}
export declare class PushTestDto extends PushEndpointDto {
    locale: 'ar' | 'en';
}
