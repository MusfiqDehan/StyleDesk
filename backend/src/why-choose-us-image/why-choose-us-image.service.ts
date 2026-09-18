import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhyChooseUsImage } from './entities/why-choose-us-image.entity.js';
import { uploadLocalImage, deleteLocalFile } from '../common/multer.js';

@Injectable()
export class WhyChooseUsImageService {
  constructor(
    @InjectRepository(WhyChooseUsImage)
    private readonly whyChooseUsImageRepository: Repository<WhyChooseUsImage>,
  ) {}

  async createOrUpdate(files: { 
    image1?: Express.Multer.File[], 
    image2?: Express.Multer.File[], 
    image3?: Express.Multer.File[], 
    image4?: Express.Multer.File[] 
  }) {
    let entity = await this.whyChooseUsImageRepository.findOne({ where: {} });
    if (!entity) {
      entity = this.whyChooseUsImageRepository.create();
    }

    const folder = 'StyleDesk/why-choose-us';

    if (files.image1?.[0]) {
      if (entity.image1) {
        await deleteLocalFile(entity.image1).catch(err =>
          console.error(`Failed to delete old why-choose-us image1 ${entity.image1}:`, err)
        );
      }
      entity.image1 = await uploadLocalImage(files.image1[0].buffer, folder);
    }
    if (files.image2?.[0]) {
      if (entity.image2) {
        await deleteLocalFile(entity.image2).catch(err =>
          console.error(`Failed to delete old why-choose-us image2 ${entity.image2}:`, err)
        );
      }
      entity.image2 = await uploadLocalImage(files.image2[0].buffer, folder);
    }
    if (files.image3?.[0]) {
      if (entity.image3) {
        await deleteLocalFile(entity.image3).catch(err =>
          console.error(`Failed to delete old why-choose-us image3 ${entity.image3}:`, err)
        );
      }
      entity.image3 = await uploadLocalImage(files.image3[0].buffer, folder);
    }
    if (files.image4?.[0]) {
      if (entity.image4) {
        await deleteLocalFile(entity.image4).catch(err =>
          console.error(`Failed to delete old why-choose-us image4 ${entity.image4}:`, err)
        );
      }
      entity.image4 = await uploadLocalImage(files.image4[0].buffer, folder);
    }

    return this.whyChooseUsImageRepository.save(entity);
  }

  async findAll() {
    const data = await this.whyChooseUsImageRepository.find();
    return data[0] || {};
  }

  async findOne(id: string) {
    const data = await this.whyChooseUsImageRepository.findOne({ where: { id } });
    if (!data) throw new NotFoundException(`WhyChooseUsImage with ID ${id} not found`);
    return data;
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    if (entity.image1) {
      await deleteLocalFile(entity.image1).catch(err =>
        console.error(`Failed to delete why-choose-us image1:`, err)
      );
    }
    if (entity.image2) {
      await deleteLocalFile(entity.image2).catch(err =>
        console.error(`Failed to delete why-choose-us image2:`, err)
      );
    }
    if (entity.image3) {
      await deleteLocalFile(entity.image3).catch(err =>
        console.error(`Failed to delete why-choose-us image3:`, err)
      );
    }
    if (entity.image4) {
      await deleteLocalFile(entity.image4).catch(err =>
        console.error(`Failed to delete why-choose-us image4:`, err)
      );
    }
    return this.whyChooseUsImageRepository.remove(entity);
  }
}
