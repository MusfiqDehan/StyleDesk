import { Injectable } from '@nestjs/common';
import { CreateCtaImageDto } from './dto/create-cta-image.dto';
import { UpdateCtaImageDto } from './dto/update-cta-image.dto';

@Injectable()
export class CtaImageService {
  create(createCtaImageDto: CreateCtaImageDto) {
    return 'This action adds a new ctaImage';
  }

  findAll() {
    return `This action returns all ctaImage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ctaImage`;
  }

  update(id: number, updateCtaImageDto: UpdateCtaImageDto) {
    return `This action updates a #${id} ctaImage`;
  }

  remove(id: number) {
    return `This action removes a #${id} ctaImage`;
  }
}
