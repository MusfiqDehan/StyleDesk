import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { UserManagementService } from './user-management.service.js';
import { UserManagementController } from './user-management.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auth } from '../auth/entities/auth.entity.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    ScopedOrmModule.forFeature([Auth]),
    AuthModule, // to access Guards and Strategies
  ],
  controllers: [UserManagementController],
  providers: [UserManagementService],
})
export class UserManagementModule {}
