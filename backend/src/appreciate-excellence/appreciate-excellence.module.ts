import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppreciateExcellenceService } from './appreciate-excellence.service';
import { AppreciateExcellenceController } from './appreciate-excellence.controller';
import { AppreciateExcellence } from './entities/appreciate-excellence.entity';

@Module({
  imports: [ScopedOrmModule.forFeature([AppreciateExcellence])],
  controllers: [AppreciateExcellenceController],
  providers: [AppreciateExcellenceService],
})
export class AppreciateExcellenceModule {}
