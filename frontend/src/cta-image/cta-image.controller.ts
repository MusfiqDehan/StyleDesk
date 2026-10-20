import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CtaImageService } from './cta-image.service';
import { CreateCtaImageDto } from './dto/create-cta-image.dto';
import { UpdateCtaImageDto } from './dto/update-cta-image.dto';

@Controller('cta-image')
export class CtaImageController {
  constructor(private readonly ctaImageService: CtaImageService) {}

  @Post()
  create(@Body() createCtaImageDto: CreateCtaImageDto) {
    return this.ctaImageService.create(createCtaImageDto);
  }

  @Get()
  findAll() {
    return this.ctaImageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ctaImageService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCtaImageDto: UpdateCtaImageDto) {
    return this.ctaImageService.update(+id, updateCtaImageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ctaImageService.remove(+id);
  }
}
