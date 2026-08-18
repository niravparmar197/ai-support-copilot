import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  // No module-level secret/signOptions: access and refresh tokens use two
  // different secrets (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET), so
  // AuthService passes the secret explicitly on every sign/verify call
  // instead of relying on one shared default.
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
