import { PartialType } from '@nestjs/swagger';
import { CreateAppreciateExcellenceDto } from './create-appreciate-excellence.dto';

export class UpdateAppreciateExcellenceDto extends PartialType(CreateAppreciateExcellenceDto) {}
