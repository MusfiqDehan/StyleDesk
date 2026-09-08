import { PartialType } from '@nestjs/swagger';
import { CreateBeginYourJourneyDto } from './create-begin-your-journey.dto';

export class UpdateBeginYourJourneyDto extends PartialType(CreateBeginYourJourneyDto) {}
