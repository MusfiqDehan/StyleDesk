import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTestimonialDto } from './dto/create-testimonial.dto.js';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Testimonial } from './entities/testimonial.entity.js';
import { Repository } from 'typeorm';

@Injectable()
export class TestimonialService {
  constructor(
    @InjectRepository(Testimonial)
    private readonly testimonialRepository: Repository<Testimonial>,
  ) {}

  create(createTestimonialDto: CreateTestimonialDto) {
    const testimonial = this.testimonialRepository.create(createTestimonialDto);
    return this.testimonialRepository.save(testimonial);
  }

  findAll() {
    return this.testimonialRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const testimonial = await this.testimonialRepository.findOne({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException(`Testimonial with ID ${id} not found`);
    }
    return testimonial;
  }

  async update(id: string, updateTestimonialDto: UpdateTestimonialDto) {
    const testimonial = await this.findOne(id);
    Object.assign(testimonial, updateTestimonialDto);
    return this.testimonialRepository.save(testimonial);
  }

  async remove(id: string) {
    const testimonial = await this.findOne(id);
    return this.testimonialRepository.remove(testimonial);
  }
}
