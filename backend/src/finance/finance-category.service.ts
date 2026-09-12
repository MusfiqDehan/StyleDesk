import { cursorRequest } from '../common/pagination/cursor.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  FinanceCategory,
  FinanceCategoryStatus,
  FinanceCategoryType,
} from './entities/finance-category.entity.js';
import { CreateFinanceCategoryDto } from './dto/create-finance-category.dto.js';
import { UpdateFinanceCategoryDto } from './dto/update-finance-category.dto.js';
import {
  SYSTEM_FINANCE_CATEGORIES,
  findSystemSeedByName,
  normalizeCategoryName,
} from './finance-categories.js';

@Injectable()
export class FinanceCategoryService implements OnModuleInit {
  private readonly logger = new Logger(FinanceCategoryService.name);

  constructor(
    @InjectRepository(FinanceCategory)
    private readonly repo: Repository<FinanceCategory>,
  ) {}

  async onModuleInit() {
    // Tenant defaults are created explicitly by provisioning.
  }

  /**
   * Backfill codes / isSystem for existing rows (incl. renamed Service Revenue),
   * and create any missing system categories.
   */
  private async ensureSystemCategories() {
    const all = await this.repo.find();
    const byCode = new Map(
      all.filter((r) => r.code).map((r) => [r.code as string, r]),
    );

    for (const seed of SYSTEM_FINANCE_CATEGORIES) {
      let row = byCode.get(seed.code) ?? null;

      if (!row) {
        const aliasSet = new Set(
          [seed.name, ...seed.aliases].map(normalizeCategoryName),
        );
        row =
          all.find(
            (r) =>
              r.type === seed.type &&
              !r.code &&
              aliasSet.has(normalizeCategoryName(r.name)),
          ) ?? null;
      }

      if (row) {
        let dirty = false;
        if (row.code !== seed.code) {
          row.code = seed.code;
          dirty = true;
        }
        if (!row.isSystem) {
          row.isSystem = true;
          dirty = true;
        }
        // Keep display names aligned with current seed (e.g. Employee Salary → Employee Salary & Bonus).
        if (row.name !== seed.name) {
          row.name = seed.name;
          dirty = true;
        }
        // Keep Employee Bonus inactive so yearly summary only shows it when bonuses exist.
        if (
          seed.code === 'employee_bonus' &&
          row.status !== FinanceCategoryStatus.INACTIVE
        ) {
          row.status = FinanceCategoryStatus.INACTIVE;
          dirty = true;
        }
        if (dirty) {
          await this.repo.save(row);
          byCode.set(seed.code, row);
        }
        continue;
      }

      const created = await this.repo.save(
        this.repo.create({
          name: seed.name,
          code: seed.code,
          isSystem: true,
          type:
            seed.type === 'income'
              ? FinanceCategoryType.INCOME
              : FinanceCategoryType.EXPENSE,
          // Employee Bonus only appears in summaries when bonus amounts exist.
          status:
            seed.code === 'employee_bonus'
              ? FinanceCategoryStatus.INACTIVE
              : FinanceCategoryStatus.ACTIVE,
        }),
      );
      byCode.set(seed.code, created);
      all.push(created);
      this.logger.log(`Created system finance category: ${seed.code}`);
    }

    // Mark any leftover seeded-looking rows that match aliases but somehow missed
    for (const row of all) {
      if (row.isSystem && row.code) continue;
      const seed = findSystemSeedByName(row.name);
      if (!seed || seed.type !== row.type) continue;
      if (byCode.has(seed.code) && byCode.get(seed.code)!.id !== row.id) continue;
      row.code = seed.code;
      row.isSystem = true;
      await this.repo.save(row);
      byCode.set(seed.code, row);
    }
  }

  async findAll(filters: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    status?: string;
    /** When true (default), only custom categories — hide system-bound ones. */
    customOnly?: boolean;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 15));
    const customOnly = filters.customOnly !== false;
    const where: Record<string, unknown> = {};

    if (customOnly) {
      where.isSystem = false;
    }

    if (filters.type === FinanceCategoryType.INCOME || filters.type === FinanceCategoryType.EXPENSE) {
      where.type = filters.type;
    }
    if (
      filters.status === FinanceCategoryStatus.ACTIVE ||
      filters.status === FinanceCategoryStatus.INACTIVE
    ) {
      where.status = filters.status;
    }
    if (filters.search?.trim()) {
      where.name = ILike(`%${filters.search.trim()}%`);
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      order: { type: 'ASC', name: 'ASC' },
      skip: cursorRequest() ? undefined : (page - 1) * limit,
      take: cursorRequest() ? undefined : limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /** Active categories for voucher/finance dropdowns (includes system). */
  async findActive(type?: string) {
    const where: {
      status: FinanceCategoryStatus;
      type?: FinanceCategoryType;
    } = { status: FinanceCategoryStatus.ACTIVE };

    if (type === FinanceCategoryType.INCOME || type === FinanceCategoryType.EXPENSE) {
      where.type = type;
    }

    return this.repo.find({
      where,
      order: { isSystem: 'DESC', name: 'ASC' },
    });
  }

  async findAllForSummary() {
    return this.repo.find({
      order: { type: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Finance category not found');
    return row;
  }

  async create(dto: CreateFinanceCategoryDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Category name is required');

    // Block creating a custom category that shadows a system name/alias
    const systemSeed = findSystemSeedByName(name);
    if (systemSeed) {
      throw new ConflictException(
        `"${name}" is a system category and cannot be created as a custom category`,
      );
    }

    const existing = await this.repo.findOne({
      where: { name, type: dto.type },
    });
    if (existing) {
      throw new ConflictException(
        `A ${dto.type} category named "${name}" already exists`,
      );
    }

    const row = this.repo.create({
      name,
      type: dto.type,
      code: null,
      isSystem: false,
      status: dto.status ?? FinanceCategoryStatus.ACTIVE,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateFinanceCategoryDto) {
    const row = await this.findOne(id);

    if (row.isSystem) {
      // System categories: display name + status only (type/code locked)
      if (dto.type !== undefined && dto.type !== row.type) {
        throw new ForbiddenException('System category type cannot be changed');
      }
      if (dto.name !== undefined) {
        const nextName = dto.name.trim();
        if (!nextName) throw new BadRequestException('Category name is required');
        if (nextName !== row.name) {
          const clash = await this.repo.findOne({
            where: { name: nextName, type: row.type },
          });
          if (clash && clash.id !== row.id) {
            throw new ConflictException(
              `A ${row.type} category named "${nextName}" already exists`,
            );
          }
          row.name = nextName;
        }
      }
      if (dto.status !== undefined) row.status = dto.status;
      return this.repo.save(row);
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : row.name;
    const nextType = dto.type ?? row.type;

    if (!nextName) throw new BadRequestException('Category name is required');

    if (findSystemSeedByName(nextName)) {
      throw new ConflictException(
        `"${nextName}" conflicts with a system category name`,
      );
    }

    if (nextName !== row.name || nextType !== row.type) {
      const clash = await this.repo.findOne({
        where: { name: nextName, type: nextType },
      });
      if (clash && clash.id !== row.id) {
        throw new ConflictException(
          `A ${nextType} category named "${nextName}" already exists`,
        );
      }
    }

    if (dto.name !== undefined) row.name = nextName;
    if (dto.type !== undefined) row.type = dto.type;
    if (dto.status !== undefined) row.status = dto.status;
    return this.repo.save(row);
  }

  async remove(id: string) {
    const row = await this.findOne(id);
    if (row.isSystem) {
      throw new ForbiddenException('System categories cannot be deleted');
    }
    await this.repo.remove(row);
    return { success: true };
  }
}
