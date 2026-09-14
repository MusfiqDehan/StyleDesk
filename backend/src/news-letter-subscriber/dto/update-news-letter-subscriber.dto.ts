import { PartialType } from '@nestjs/swagger';
import { CreateNewsLetterSubscriberDto } from './create-news-letter-subscriber.dto';

export class UpdateNewsLetterSubscriberDto extends PartialType(CreateNewsLetterSubscriberDto) {}
