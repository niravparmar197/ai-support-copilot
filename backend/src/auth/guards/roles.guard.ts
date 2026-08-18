import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

// Deliberately separate from JwtAuthGuard: 401 (not authenticated) and 403
// (authenticated, wrong role) are different failure modes and callers
// should be able to tell them apart. Always applied *after* JwtAuthGuard
// (@UseGuards(JwtAuthGuard, RolesGuard) — guards run in array order) so
// req.user is already populated by the time this runs.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // No @Roles() on this route — nothing for this guard to enforce.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser | undefined;

    // If req.user is missing here, JwtAuthGuard either didn't run or was
    // applied after this guard — a wiring bug on the route, not something
    // to quietly paper over.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
