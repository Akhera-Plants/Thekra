/**
 * Phase 4: convenience re-export so all admin controllers can import from one
 * path without knowing the guard/decorator locations.
 *
 * Usage (replaces @UseGuards(AdminApiKeyGuard)):
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('ADMIN')
 */
export { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard.js';
export { RolesGuard } from '../../modules/auth/guards/roles.guard.js';
export { Roles } from '../decorators/roles.decorator.js';
