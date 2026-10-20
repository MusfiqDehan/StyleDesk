import { Module } from '@nestjs/common';
import { CtaImageService } from './cta-image.service';
import { CtaImageController } from './cta-image.controller';

@Module({
  controllers: [CtaImageController],
  providers: [CtaImageService],
})
export class CtaImageModule {}
