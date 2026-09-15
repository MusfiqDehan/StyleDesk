import { SocketTenantAuth } from '../tenancy/socket-tenant-auth.js';
import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auth } from '../auth/entities/auth.entity.js';
import { requireJwtSecret } from '../auth/require-jwt-secret.js';
import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationGateway } from './notification.gateway.js';

@Global()
@Module({
  imports: [
    ConfigModule,
    ScopedOrmModule.forFeature([Auth]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        return { secret: requireJwtSecret(secret) };
      },
    }),
  ],
  providers: [NotificationGateway, SocketTenantAuth],
  exports: [NotificationGateway, SocketTenantAuth],
})
export class NotificationModule {}
