import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TestimonialService } from './testimonial.service.js';
import { TestimonialController } from './testimonial.controller.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Testimonial } from './entities/testimonial.entity.js';

@Module({
  imports: [ScopedOrmModule.forFeature([Testimonial])],
  controllers: [TestimonialController],
  providers: [TestimonialService],
})
export class TestimonialModule {}
