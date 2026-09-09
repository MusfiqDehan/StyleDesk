import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { BussinessInfoService } from './bussiness-info.service.js';
import { BussinessInfoController } from './bussiness-info.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BussinessInfo } from './entities/bussiness-info.entity.js';

@Module({
  imports: [ScopedOrmModule.forFeature([BussinessInfo])],
  controllers: [BussinessInfoController],
  providers: [BussinessInfoService],
  exports: [BussinessInfoService],
})
export class BussinessInfoModule {}
