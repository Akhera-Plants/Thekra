import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { EnvironmentVariables } from '../../../config/env.validation.js';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator.js';

/**
 * 'jwt' strategy — validates access tokens.
 * Payload shape: { sub: userId, email, role }.
 * Used by JwtAuthGuard and OptionalJwtAuthGuard.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<EnvironmentVariables>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>('JWT_ACCESS_SECRET') ??
        'thekra-access-secret-change-in-production',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    // Return value is set on request.user by Passport.
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
