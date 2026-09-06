import { PartialType } from '@nestjs/swagger';
import { CreateStyleDeskPackageDto } from './create-StyleDesk-package.dto';

export class UpdateStyleDeskPackageDto extends PartialType(CreateStyleDeskPackageDto) {}
