import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auth } from './entities/auth.entity.js';
import { RolePermission } from '../role-permission/entities/role-permission.entity.js';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { RolesGuard } from './roles.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { requireJwtSecret } from './require-jwt-secret.js';

import { Employee } from '../employee/entities/employee.entity.js';
import { ClientsModule } from '../clients/clients.module.js';
import { ServiceModule } from '../service/service.module.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([Auth, Employee, RolePermission]),
    ClientsModule,
    ServiceModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        return {
          secret: requireJwtSecret(configService.get<string>('JWT_SECRET')),
          signOptions: {
            audience: 'styledesk-tenant',
            expiresIn: configService.get<string>('JWT_ACCESSTOKEN_EXPIRES_IN') ?? '1d',
          },
        } as JwtModuleOptions;
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtStrategy, PassportModule, JwtAuthGuard, RolesGuard, PermissionsGuard],
})
export class AuthModule { }
