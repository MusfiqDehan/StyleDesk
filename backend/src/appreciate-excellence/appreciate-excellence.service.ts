import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAppreciateExcellenceDto } from './dto/create-appreciate-excellence.dto';
import { UpdateAppreciateExcellenceDto } from './dto/update-appreciate-excellence.dto';
import { AppreciateExcellence } from './entities/appreciate-excellence.entity';
import { uploadLocalVideo, deleteLocalFile } from '../common/multer.js';

@Injectable()
export class AppreciateExcellenceService {
  constructor(
    @InjectRepository(AppreciateExcellence)
    private readonly repository: Repository<AppreciateExcellence>,
  ) {}

  async findSingle() {
    const excellence = await this.repository.find({
      order: { createdAt: 'DESC' },
      take: 1
    });
    return excellence[0] || null;
  }

  async upsert(dto: CreateAppreciateExcellenceDto, file?: Express.Multer.File) {
    let excellence = await this.findSingle();

    if (file) {
      // If updating, delete old video
      if (excellence && excellence.videoUrl) {
        await deleteLocalFile(excellence.videoUrl, 'video').catch(err =>
          console.error(`Failed to delete old excellence video ${excellence.videoUrl}:`, err)
        );
      }
      // Upload new video
      dto.videoUrl = await uploadLocalVideo(file.buffer, 'StyleDesk/appreciate-excellence');
    } else if (excellence && (dto.videoUrl === null || dto.videoUrl === '')) {
      // If video was explicitly removed
      if (excellence.videoUrl) {
        await deleteLocalFile(excellence.videoUrl, 'video').catch(err =>
          console.error(`Failed to delete old excellence video ${excellence.videoUrl}:`, err)
        );
      }
    }

    if (excellence) {
      this.repository.merge(excellence, dto);
      return this.repository.save(excellence);
    } else {
      if (!dto.videoUrl) throw new BadRequestException('Video file is required for initial creation');
      const newExcellence = this.repository.create(dto);
      return this.repository.save(newExcellence);
    }
  }
}
