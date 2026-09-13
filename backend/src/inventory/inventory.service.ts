import { cursorQueryRows } from '../common/pagination/cursor-query.js';
import { cursorRequest } from '../common/pagination/cursor.js';
import { SCOPED_CACHE_MANAGER } from '../tenancy/tenancy.module.js';
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { Inventory } from './entities/inventory.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @Inject(SCOPED_CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createInventoryDto: CreateInventoryDto) {
    const item = this.inventoryRepository.create(createInventoryDto);
    const saved = await this.inventoryRepository.save(item);
    await this.cacheManager.del('dashboard:stats');
    return saved;
  }

  async findAll(
    filters?: { name?: string },
    page: number = 1,
    limit: number = 10,
    sortStock?: 'asc' | 'desc',
  ) {
    const skip = (page - 1) * limit;
    const qb = this.inventoryRepository.createQueryBuilder('inventory');

    if (filters?.name) {
      qb.andWhere('inventory.name ILIKE :name', { name: `%${filters.name.trim()}%` });
    }

    if (sortStock) {
      qb.orderBy('CAST(inventory.stockQty AS INT)', sortStock.toUpperCase() as 'ASC' | 'DESC');
    } else {
      qb.orderBy('inventory.createdAt', 'DESC');
    }

    const cursor = cursorRequest();
    const [data, total] = cursor ? [await cursorQueryRows(qb, ['/inventory']), cursor.pageInfo!.total] : await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const item = await this.inventoryRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Inventory item #${id} not found`);
    return item;
  }

  async update(id: string, updateInventoryDto: UpdateInventoryDto) {
    const item = await this.findOne(id);
    this.inventoryRepository.merge(item, updateInventoryDto);
    const updated = await this.inventoryRepository.save(item);
    await this.cacheManager.del('dashboard:stats');
    return updated;
  }

  async remove(id: string) {
    const item = await this.findOne(id);
    const removed = await this.inventoryRepository.remove(item);
    await this.cacheManager.del('dashboard:stats');
    return removed;
  }
}
