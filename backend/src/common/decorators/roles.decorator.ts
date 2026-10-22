import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Attaches a required-roles list to a controller or route handler.
 * Must be combined with @UseGuards(JwtAuthGuard, RolesGuard).
 *
 * Usage:
 *   @Roles('ADMIN')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
