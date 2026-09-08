import { ScopedOrmModule } from '../tenancy/scoped-orm.module.js';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BeginYourJourneyService } from './begin-your-journey.service';
import { BeginYourJourneyController } from './begin-your-journey.controller';
import { BeginYourJourney } from './entities/begin-your-journey.entity';

@Module({
  imports: [ScopedOrmModule.forFeature([BeginYourJourney])],
  controllers: [BeginYourJourneyController],
  providers: [BeginYourJourneyService],
})
export class BeginYourJourneyModule {}
