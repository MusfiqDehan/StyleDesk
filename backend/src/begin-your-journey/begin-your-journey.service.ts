import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BeginYourJourney } from './entities/begin-your-journey.entity';
import { uploadLocalImage, deleteLocalFile } from '../common/multer.js';

@Injectable()
export class BeginYourJourneyService {
  constructor(
    @InjectRepository(BeginYourJourney)
    private readonly repository: Repository<BeginYourJourney>,
  ) {}

  async findSingle() {
    const journey = await this.repository.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return journey[0] || null;
  }

  async upsert(file?: Express.Multer.File) {
    let journey = await this.findSingle();

    if (!file) {
      if (!journey) {
        throw new BadRequestException('Image file is required for initial creation');
      }
      return journey;
    }

    // If updating and old image exists, delete it first
    if (journey && journey.imageUrl) {
      await deleteLocalFile(journey.imageUrl).catch(err =>
        console.error(`Failed to delete old journey image ${journey.imageUrl}:`, err)
      );
    }

    // Upload the new image first
    const imageUrl = await uploadLocalImage(file.buffer, 'StyleDesk/begin-your-journey');

    if (journey) {
      journey.imageUrl = imageUrl;
      return this.repository.save(journey);
    } else {
      const newJourney = this.repository.create({ imageUrl });
      return this.repository.save(newJourney);
    }
  }
}
