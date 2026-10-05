import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  imports: [
    PassportModule,
    // JwtModule: used only for JwtService.sign(); verification uses jwt.verify()
    // with explicit per-token secrets, so access and refresh use different secrets.
    // expiresIn is overridden per-call in AuthService.issueTokens() (as seconds).
    JwtModule.register({
      secret: 'placeholder', // overridden per-call via sign() options
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
})
export class AuthModule {}
