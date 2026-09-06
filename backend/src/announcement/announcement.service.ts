import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Announcement } from './entities/announcement.entity';

@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(Announcement)
    private readonly repo: Repository<Announcement>,
  ) {}

  create(dto: CreateAnnouncementDto): Promise<Announcement> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  findAll(): Promise<Announcement[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Announcement> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Announcement #${id} not found`);
    return record;
  }

  async update(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const record = await this.findOne(id);
    Object.assign(record, dto);
    return this.repo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.repo.remove(record);
  }
}
