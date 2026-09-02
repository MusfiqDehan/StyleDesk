import { PlatformModule } from './platform/platform.module.js';
import { TenantAccessGuard } from './platform/access.service.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { ScopedOrmModule } from './tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CursorPaginationInterceptor } from './common/pagination/cursor.interceptor.js';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TenantThrottlerGuard } from './tenancy/tenant-throttler.guard.js';
import { ThrottlerModule, minutes } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database.module.js';
import { User } from './user.entity.js';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { InvoiceModule } from './invoice/invoice.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { ServiceModule } from './service/service.module.js';
import { EmployeeModule } from './employee/employee.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { UserManagementModule } from './user-management/user-management.module.js';
import { LeaveRequestModule } from './leave-request/leave-request.module.js';
import { AnnouncementModule } from './announcement/announcement.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { CacheModule } from '@nestjs/cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'
import { ReportsModule } from './reports/reports.module.js';
import { BussinessInfoModule } from './bussiness-info/bussiness-info.module.js';
import { AppointmentSettingModule } from './appointment-setting/appointment-setting.module.js';
import { InvoiceSettingModule } from './invoice-setting/invoice-setting.module.js';
import { PayrollModule } from './payroll/payroll.module.js';
import { StyleDeskPackagesModule } from './StyleDesk-packages/StyleDesk-packages.module.js';
import { BiometricModule } from './biometric/biometric.module.js';
import { TestimonialModule } from './testimonial/testimonial.module.js';
import { WhyChooseUsImageModule } from './why-choose-us-image/why-choose-us-image.module.js';
import { AppreciateExcellenceModule } from './appreciate-excellence/appreciate-excellence.module';
import { DeviceConfigModule } from './device-config/device-config.module.js';
import { DeviceDiscoveryModule } from './device-discovery/device-discovery.module.js';
import { IclockModule } from './iclock/iclock.module';
import { NotificationModule } from './notification/notification.module.js';
import { BeginYourJourneyModule } from './begin-your-journey/begin-your-journey.module';
import { SisterConcernsModule } from './sister-concerns/sister-concerns.module.js';
import { NewsLetterSubscriberModule } from './news-letter-subscriber/news-letter-subscriber.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { RolePermissionModule } from './role-permission/role-permission.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    // Global baseline; tighter limits via @Throttle() on auth routes
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: minutes(1),
        limit: 120,
      },
    ]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ttl: 60 * 5 * 1000

      })

    }),
    DatabaseModule,
    TenancyModule,
    PlatformModule,
    ScopedOrmModule.forFeature([User]),
    AppointmentsModule,
    ClientsModule,
    InvoiceModule,
    AttendanceModule,
    ServiceModule,
    EmployeeModule,
    InventoryModule,
    AuthModule, UserManagementModule, LeaveRequestModule, AnnouncementModule,
    DashboardModule,
    ReportsModule,
    BussinessInfoModule,
    AppointmentSettingModule,
    InvoiceSettingModule,
    PayrollModule,
    StyleDeskPackagesModule,
    BiometricModule,
    DeviceConfigModule,
    DeviceDiscoveryModule,
    TestimonialModule,
    WhyChooseUsImageModule,
    AppreciateExcellenceModule,
    IclockModule,
    NotificationModule,
    BeginYourJourneyModule,
    SisterConcernsModule,
    NewsLetterSubscriberModule,
    FinanceModule,
    RolePermissionModule,
  ],
  controllers: [AppController, UserController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: CursorPaginationInterceptor },
    AppService,
    UserService,
    // Secure-by-default: all routes require JWT unless marked @Public()
    // Reject abusive traffic before JWT validation hits the database.
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantAccessGuard },
  ],
})
export class AppModule { }
