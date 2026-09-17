import { cursorQueryRows } from '../common/pagination/cursor-query.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service, ServiceCategory, ServiceStatus } from './entities/service.entity';
import { deleteLocalFile, uploadLocalImage } from '../common/multer.js';

/** Collapse tabs/spaces so DB names match trimmed booking labels. */
export function normalizeServiceName(name: string | undefined | null): string {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
  ) { }

  async create(createServiceDto: CreateServiceDto, file?: Express.Multer.File) {
    if (file) {
      createServiceDto.imageUrl = await uploadLocalImage(file.buffer, 'StyleDesk/services');
    }
    if (typeof createServiceDto.name === 'string') {
      createServiceDto.name = normalizeServiceName(createServiceDto.name);
    }
    const { ...data } = createServiceDto;
    const service = this.serviceRepository.create(data as CreateServiceDto);
    return this.serviceRepository.save(service);
  }

  private buildQuery(
    name?: string,
    category?: ServiceCategory,
    sortPrice?: 'asc' | 'desc',
    onlyActive = false,
  ) {
    const qb = this.serviceRepository.createQueryBuilder('service');
    if (onlyActive) qb.andWhere('service.status = :status', { status: ServiceStatus.ACTIVE });
    if (name) qb.andWhere('service.name ILIKE :name', { name: `%${name}%` });
    if (category) qb.andWhere('CAST(service.category AS TEXT) ILIKE :category', { category });
    if (sortPrice) qb.orderBy('CAST(service.price AS DECIMAL)', sortPrice.toUpperCase() as 'ASC' | 'DESC');
    return cursorQueryRows(qb, ["/service", "/service/active", "/service/artists"]);
  }

  findAll(name?: string, category?: ServiceCategory, sortPrice?: 'asc' | 'desc') {
    return this.buildQuery(name, category, sortPrice, false);
  }

  findActive(name?: string, category?: ServiceCategory, sortPrice?: 'asc' | 'desc') {
    return this.buildQuery(name, category, sortPrice, true);
  }

  async findOne(id: string) {
    const service = await this.serviceRepository.findOne({ where: { id } });
    if (!service) throw new NotFoundException(`Service #${id} not found`);
    return service;
  }

  /**
   * Match by normalized name (trim + collapse whitespace).
   * Production rows often have trailing tabs that break exact `IN (...)` lookups.
   */
  async findByNames(names: string[]): Promise<Service[]> {
    const wanted = new Set(
      names.map((n) => normalizeServiceName(n).toLowerCase()).filter(Boolean),
    );
    if (wanted.size === 0) return [];

    const active = await this.findActive();
    return active.filter((s) => wanted.has(normalizeServiceName(s.name).toLowerCase()));
  }

  async calculateTotal(serviceNames: string[]): Promise<number> {
    if (!serviceNames || serviceNames.length === 0) return 0;
    const counts: Record<string, number> = {};
    for (const name of serviceNames) {
      const key = normalizeServiceName(name).toLowerCase();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const uniqueNames = Object.keys(counts);
    if (uniqueNames.length === 0) return 0;
    const services = await this.findByNames(uniqueNames);
    return services.reduce((sum, s) => {
      const qty = counts[normalizeServiceName(s.name).toLowerCase()] ?? 1;
      return sum + qty * Number(s.price);
    }, 0);
  }

  // Used for commission: looks up by name regardless of status, so a service
  // deactivated after booking still generates the correct commission.
  // Handles duplicates in serviceNames (e.g. same service booked multiple times).
  async calculateCommission(serviceNames: string[]): Promise<number> {
    if (!serviceNames || serviceNames.length === 0) return 0;

    const counts: Record<string, number> = {};
    for (const name of serviceNames) {
      const key = normalizeServiceName(name).toLowerCase();
      if (!key) continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    const uniqueKeys = Object.keys(counts);
    if (uniqueKeys.length === 0) return 0;

    const all = await this.serviceRepository.find();
    const matched = all.filter((s) =>
      uniqueKeys.includes(normalizeServiceName(s.name).toLowerCase()),
    );
    return matched.reduce((sum, s) => {
      const qty = counts[normalizeServiceName(s.name).toLowerCase()] ?? 1;
      return sum + qty * (Number(s.price) * Number(s.commission) / 100);
    }, 0);
  }

  async update(id: string, updateServiceDto: UpdateServiceDto, file?: Express.Multer.File) {
    const service = await this.findOne(id);

    if (file) {
      // If a new image is provided, delete the old one
      if (service.imageUrl) {
        await deleteLocalFile(service.imageUrl).catch(err =>
          console.error(`Failed to delete old image ${service.imageUrl}:`, err)
        );
      }
      updateServiceDto.imageUrl = await uploadLocalImage(file.buffer, 'StyleDesk/services');
    } else if (updateServiceDto.imageUrl === null || updateServiceDto.imageUrl === '') {
      // If image was removed (imageUrl set to null or empty)
      if (service.imageUrl) {
        await deleteLocalFile(service.imageUrl).catch(err =>
          console.error(`Failed to delete old image ${service.imageUrl}:`, err)
        );
      }
    }

    if (typeof updateServiceDto.name === 'string') {
      updateServiceDto.name = normalizeServiceName(updateServiceDto.name);
    }

    // Filter out id and any extra fields that are not in the service entity
    const { ...updateData } = updateServiceDto;

    // Use merge for safer entity updates
    this.serviceRepository.merge(service, updateData);

    return this.serviceRepository.save(service);
  }

  async remove(id: string) {
    const service = await this.findOne(id);

    // If the service has an image, delete it from Cloudinary
    if (service.imageUrl) {
      await deleteLocalFile(service.imageUrl);
    }

    return this.serviceRepository.remove(service);
  }

  /**
   * Counts occurrences per name so a service booked multiple times in one appointment
   * (qty > 1, encoded as repeated names) increments bookingCount that many times —
   * matches how package bookingCount is incremented once per occurrence, not once per
   * unique title.
   */
  private countByNormalizedName(serviceNames: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const raw of serviceNames || []) {
      const key = normalizeServiceName(raw).toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }

  /** +qty confirmed bookings per service name (qty = occurrences in the input array) */
  async incrementBookingCounts(serviceNames: string[]) {
    const counts = this.countByNormalizedName(serviceNames);
    if (counts.size === 0) return;
    const matched = (await this.serviceRepository.find()).filter((s) =>
      counts.has(normalizeServiceName(s.name).toLowerCase()),
    );
    if (matched.length === 0) return;
    await Promise.all(
      matched.map((s) => {
        const qty = counts.get(normalizeServiceName(s.name).toLowerCase()) ?? 1;
        return this.serviceRepository
          .createQueryBuilder()
          .update(Service)
          .set({ bookingCount: () => '"bookingCount" + :qty' })
          .where('id = :id', { id: s.id })
          .setParameter('qty', qty)
          .execute();
      }),
    );
  }

  /** -qty confirmed bookings per service name (qty = occurrences in the input array; floor at 0) */
  async decrementBookingCounts(serviceNames: string[]) {
    const counts = this.countByNormalizedName(serviceNames);
    if (counts.size === 0) return;
    const matched = (await this.serviceRepository.find()).filter((s) =>
      counts.has(normalizeServiceName(s.name).toLowerCase()),
    );
    if (matched.length === 0) return;
    await Promise.all(
      matched.map((s) => {
        const qty = counts.get(normalizeServiceName(s.name).toLowerCase()) ?? 1;
        return this.serviceRepository
          .createQueryBuilder()
          .update(Service)
          .set({ bookingCount: () => 'GREATEST("bookingCount" - :qty, 0)' })
          .where('id = :id', { id: s.id })
          .setParameter('qty', qty)
          .execute();
      }),
    );
  }
}
