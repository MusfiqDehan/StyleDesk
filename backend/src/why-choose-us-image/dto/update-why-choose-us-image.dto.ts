import { PartialType } from '@nestjs/swagger';
import { CreateWhyChooseUsImageDto } from './create-why-choose-us-image.dto';

export class UpdateWhyChooseUsImageDto extends PartialType(CreateWhyChooseUsImageDto) {}
