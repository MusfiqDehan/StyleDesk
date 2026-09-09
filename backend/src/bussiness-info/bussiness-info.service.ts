import { BadRequestException, Injectable } from '@nestjs/common';
import { UpdateBussinessInfoDto } from './dto/update-bussiness-info.dto.js';
import { InjectRepository } from '@nestjs/typeorm';
import { BussinessInfo } from './entities/bussiness-info.entity.js';
import { Repository } from 'typeorm';
import { uploadLocalImage, deleteLocalFile } from '../common/multer.js';
import { parseGoogleMapsUrlToEmbed, resolveGoogleMapsEmbedUrl } from '../common/google-maps-embed.util.js';

@Injectable()
export class BussinessInfoService {
  constructor(
    @InjectRepository(BussinessInfo)
    private readonly bussinessInfoRepository: Repository<BussinessInfo>,
  ) {}

  async resolveMapEmbedUrl(url: string) {
    const trimmed = url?.trim();
    if (!trimmed) {
      throw new BadRequestException('Map URL is required');
    }

    const resolved =
      parseGoogleMapsUrlToEmbed(trimmed) ?? (await resolveGoogleMapsEmbedUrl(trimmed));

    if (!resolved) {
      throw new BadRequestException(
        'Could not convert this Google Maps link to an embed URL. Open Google Maps → Share → Embed a map, then paste the iframe src URL.',
      );
    }

    return { embedUrl: resolved };
  }

  async createOrUpdate(updateDto: UpdateBussinessInfoDto) {
    if (updateDto.mapEmbedUrl?.trim()) {
      const resolved =
        parseGoogleMapsUrlToEmbed(updateDto.mapEmbedUrl) ??
        (await resolveGoogleMapsEmbedUrl(updateDto.mapEmbedUrl));

      if (!resolved) {
        throw new BadRequestException(
          'Could not convert this Google Maps link to an embed URL. Open Google Maps → Share → Embed a map, then paste the iframe src URL.',
        );
      }

      updateDto.mapEmbedUrl = resolved;
    }

    let businessInfo = await this.bussinessInfoRepository.findOne({
      where: {}, // Get the first record
    });

    if (!businessInfo) {
      businessInfo = this.bussinessInfoRepository.create(updateDto);
    } else {
      Object.assign(businessInfo, updateDto);
    }

    return await this.bussinessInfoRepository.save(businessInfo);
  }

  async findOne() {
    const businessInfo = await this.bussinessInfoRepository.findOne({
      where: {},
    });
    if (!businessInfo) {
      // Return an empty object or a default structure if not found
      return null;
    }
    return businessInfo;
  }

  async getSiteVisibility(): Promise<{ hideMainWebsite: boolean }> {
    const businessInfo = await this.bussinessInfoRepository.findOne({
      where: {},
      select: { id: true, hideMainWebsite: true },
    });
    return { hideMainWebsite: Boolean(businessInfo?.hideMainWebsite) };
  }

  async uploadLogo(buffer: Buffer) {
    // Delete old logo if one exists
    const existing = await this.bussinessInfoRepository.findOne({ where: {} });
    if (existing?.logoUrl) {
      await deleteLocalFile(existing.logoUrl, 'image');
    }

    const logoUrl = await uploadLocalImage(buffer, 'StyleDesk/logo');

    // Persist the new logoUrl
    const updated = await this.createOrUpdate({ logoUrl });
    return updated;
  }
}
