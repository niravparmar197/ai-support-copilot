import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';

@Module({
  // Separate PassportModule.register (own default strategy name isn't
  // relevant here since both this and AuthModule's JwtStrategy register
  // under distinct explicit names — 'jwt' vs 'customer-jwt') and its own
  // JwtModule.register({}) for the same reason AuthModule has one: secrets
  // are passed explicitly per sign/verify call, never as a module default.
  imports: [PassportModule, JwtModule.register({})],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerJwtStrategy],
})
export class CustomerAuthModule {}
