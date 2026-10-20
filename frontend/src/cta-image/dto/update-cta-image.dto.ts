import { PartialType } from '@nestjs/mapped-types';
import { CreateCtaImageDto } from './create-cta-image.dto';

export class UpdateCtaImageDto extends PartialType(CreateCtaImageDto) {}
