import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsLetterSubscriberService } from './news-letter-subscriber.service.js';
import { NewsLetterSubscriberController } from './news-letter-subscriber.controller.js';
import { NewsLetterSubscriber } from './entities/news-letter-subscriber.entity.js';

@Module({
  imports: [ScopedOrmModule.forFeature([NewsLetterSubscriber])],
  controllers: [NewsLetterSubscriberController],
  providers: [NewsLetterSubscriberService],
  exports: [NewsLetterSubscriberService],
})
export class NewsLetterSubscriberModule {}
