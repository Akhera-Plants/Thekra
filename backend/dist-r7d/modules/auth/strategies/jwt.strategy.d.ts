import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../../../config/env.validation.js';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator.js';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(config: ConfigService<EnvironmentVariables>);
    validate(payload: JwtPayload): JwtPayload;
}
export {};
