import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ClsModule } from 'nestjs-cls';
import { validate } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { CompaniesModule } from './platform/companies/companies.module';
import { DashboardModule } from './platform/dashboard/dashboard.module';
import { UsersModule } from './company/users/users.module';
import { CompanyDashboardModule } from './company/dashboard/dashboard.module';
import { CustomersModule } from './company/customers/customers.module';
import { CustomerAuthModule } from './customer-auth/customer-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
      validate,
    }),
    // Middleware-based (not guard-based) mounting: nestjs-cls's guard-based
    // option (ClsGuard) opens the CLS async-local-storage context via
    // AsyncLocalStorage.enterWith(), which has a known context-loss bug on
    // Node < 24 (this repo runs Node 22) — confirmed empirically here: with
    // guard-based mounting, values written into CLS inside JwtAuthGuard
    // were visible immediately after the write but had reverted to
    // undefined by the time the controller handler read them back.
    // ClsMiddleware instead wraps the entire rest of the request pipeline
    // (every guard, interceptor, and the handler) in a genuine
    // `AsyncLocalStorage.run(store, next)` callback, which is structurally
    // guaranteed to propagate. This only changes how the ambient CLS store
    // itself gets opened — JwtAuthGuard (route-level, see
    // auth/guards/jwt-auth.guard.ts) still does the actual tenantId/userId
    // write, still only after the JWT is verified. Nest applies middleware
    // before any guard runs, so that ordering is unaffected.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    PlatformModule,
    CompaniesModule,
    DashboardModule,
    UsersModule,
    CompanyDashboardModule,
    CustomersModule,
    CustomerAuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
