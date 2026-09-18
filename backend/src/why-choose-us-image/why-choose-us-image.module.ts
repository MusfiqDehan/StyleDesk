import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhyChooseUsImageService } from './why-choose-us-image.service.js';
import { WhyChooseUsImageController } from './why-choose-us-image.controller.js';
import { WhyChooseUsImage } from './entities/why-choose-us-image.entity.js';

@Module({
  imports: [ScopedOrmModule.forFeature([WhyChooseUsImage])],
  controllers: [WhyChooseUsImageController],
  providers: [WhyChooseUsImageService],
})
export class WhyChooseUsImageModule {}
