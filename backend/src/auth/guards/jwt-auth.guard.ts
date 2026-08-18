import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import type { AppClsStore } from '../../common/tenant-context';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

// Extended (rather than a separate TenantContextGuard chained after it)
// so every existing `@UseGuards(JwtAuthGuard)` call site gets tenant
// context propagation for free — no route needs to remember to add a
// second guard. This runs after super.canActivate(), which is what
// invokes JwtStrategy.validate() and attaches the DB-verified user to
// request.user, so tenantId/userId written here always come from a
// verified token, never from anything request-supplied.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly cls: ClsService<AppClsStore>) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = (await super.canActivate(context)) as boolean;

    if (!activated) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AuthenticatedUser;

    this.cls.set('tenantId', user.tenantId);
    this.cls.set('userId', user.id);

    return true;
  }
}
