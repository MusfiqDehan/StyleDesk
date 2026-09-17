import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SisterConcerns } from './entities/sister-concerns.entity.js';
import { UpsertSisterConcernsDto } from './dto/upsert-sister-concerns.dto.js';
import { deleteLocalFile, uploadLocalImage } from '../common/multer.js';

@Injectable()
export class SisterConcernsService {
  constructor(
    @InjectRepository(SisterConcerns)
    private readonly repository: Repository<SisterConcerns>,
  ) {}

  async findSingle() {
    const records = await this.repository.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    return records[0] || null;
  }

  async upsert(dto: UpsertSisterConcernsDto, file?: Express.Multer.File) {
    const record = await this.findSingle();
    const updates: Partial<SisterConcerns> = { ...dto };

    if (file) {
      if (record?.imageUrl) {
        await deleteLocalFile(record.imageUrl).catch((err) =>
          console.error(`Failed to delete old sister concerns image ${record.imageUrl}:`, err),
        );
      }
      updates.imageUrl = await uploadLocalImage(file.buffer, 'StyleDesk/sister-concerns');
    }

    if (record) {
      this.repository.merge(record, updates);
      return this.repository.save(record);
    }

    const created = this.repository.create(updates);
    return this.repository.save(created);
  }
}
