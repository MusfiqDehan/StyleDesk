import { PartialType } from '@nestjs/swagger';
import { CreateBussinessInfoDto } from './create-bussiness-info.dto.js';

export class UpdateBussinessInfoDto extends PartialType(CreateBussinessInfoDto) {}
