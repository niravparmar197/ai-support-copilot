import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Deliberately its own guard/strategy pair rather than JwtAuthGuard with a
// branch — see D-029: a customer token must never verify against a staff
// route or vice versa, and keeping the two guards structurally separate is
// what makes that true regardless of which routes get which guard.
@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('customer-jwt') {}
