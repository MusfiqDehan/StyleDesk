import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission } from './entities/role-permission.entity.js';
import { Auth } from '../auth/entities/auth.entity.js';
import { RolePermissionService } from './role-permission.service.js';
import { RolePermissionController } from './role-permission.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([RolePermission, Auth]),
    AuthModule,
  ],
  controllers: [RolePermissionController],
  providers: [RolePermissionService],
  exports: [RolePermissionService],
})
export class RolePermissionModule {}
