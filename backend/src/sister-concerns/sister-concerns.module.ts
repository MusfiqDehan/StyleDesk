import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SisterConcerns } from './entities/sister-concerns.entity.js';
import { SisterConcernsService } from './sister-concerns.service.js';
import { SisterConcernsController } from './sister-concerns.controller.js';

@Module({
  imports: [ScopedOrmModule.forFeature([SisterConcerns])],
  controllers: [SisterConcernsController],
  providers: [SisterConcernsService],
})
export class SisterConcernsModule {}
