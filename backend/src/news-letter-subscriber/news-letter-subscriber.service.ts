import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsLetterSubscriber } from './entities/news-letter-subscriber.entity.js';
import { CreateNewsLetterSubscriberDto } from './dto/create-news-letter-subscriber.dto.js';
import { UpdateNewsLetterSubscriberDto } from './dto/update-news-letter-subscriber.dto.js';

@Injectable()
export class NewsLetterSubscriberService {
  constructor(
    @InjectRepository(NewsLetterSubscriber)
    private readonly repository: Repository<NewsLetterSubscriber>,
  ) {}

  async create(createNewsLetterSubscriberDto: CreateNewsLetterSubscriberDto): Promise<NewsLetterSubscriber> {
    const email = createNewsLetterSubscriberDto.email.trim().toLowerCase();
    
    const existing = await this.repository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('This email is already subscribed');
    }

    const subscriber = this.repository.create({ email });
    return this.repository.save(subscriber);
  }

  async findAll(): Promise<NewsLetterSubscriber[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<NewsLetterSubscriber> {
    const subscriber = await this.repository.findOne({ where: { id } });
    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID "${id}" not found`);
    }
    return subscriber;
  }

  async update(id: string, updateNewsLetterSubscriberDto: UpdateNewsLetterSubscriberDto): Promise<NewsLetterSubscriber> {
    const subscriber = await this.findOne(id);

    if (updateNewsLetterSubscriberDto.email) {
      const email = updateNewsLetterSubscriberDto.email.trim().toLowerCase();
      if (email !== subscriber.email) {
        const existing = await this.repository.findOne({ where: { email } });
        if (existing) {
          throw new ConflictException('This email is already subscribed');
        }
        subscriber.email = email;
      }
    }

    return this.repository.save(subscriber);
  }

  async remove(id: string): Promise<{ message: string }> {
    const subscriber = await this.findOne(id);
    await this.repository.remove(subscriber);
    return { message: `Subscriber with ID "${id}" successfully removed` };
  }
}
