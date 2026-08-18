import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  // No module-level secret/signOptions: access and refresh tokens use two
  // different secrets (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET), so
  // AuthService passes the secret explicitly on every sign/verify call
  // instead of relying on one shared default.
  imports: [PassportModule, JwtModule.register({}), PermissionsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // CompaniesModule injects AuthService directly for
  // POST /platform/companies/:id/impersonate rather than duplicating
  // token-minting logic (D-026).
  exports: [AuthService],
})
export class AuthModule {}
