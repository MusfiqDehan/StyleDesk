import { cursorQueryRows } from '../common/pagination/cursor-query.js';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStyleDeskPackageDto } from './dto/create-StyleDesk-package.dto';
import { UpdateStyleDeskPackageDto } from './dto/update-StyleDesk-package.dto';
import { StyleDeskPackage } from './entities/StyleDesk-package.entity';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';

@Injectable()
export class StyleDeskPackagesService implements OnModuleInit {
  constructor(
    @InjectRepository(StyleDeskPackage)
    private readonly packageRepository: Repository<StyleDeskPackage>,
    private readonly appointmentsService: AppointmentsService,
  ) { }

  async onModuleInit() {
    // Tenant defaults are created explicitly by provisioning.
  }

  async create(createStyleDeskPackageDto: CreateStyleDeskPackageDto) {
    if (createStyleDeskPackageDto.popular === true) {
      await this.packageRepository
        .createQueryBuilder()
        .update(StyleDeskPackage)
        .set({ popular: false })
        .where('popular = :popular', { popular: true })
        .execute();
    }

    const pkg = this.packageRepository.create(createStyleDeskPackageDto);
    return this.packageRepository.save(pkg);
  }

  findAll() {
    // Display order is applied client-side from business-info packagesSortOrder;
    // newest-first is a sensible default for API consumers.
    return cursorQueryRows(this.packageRepository.createQueryBuilder('package').orderBy('package.createdAt', 'DESC'), ['/StyleDesk-packages']);
  }

  async findOne(id: string) {
    const pkg = await this.packageRepository.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException(`Package with ID ${id} not found`);
    return pkg;
  }

  async update(id: string, updateStyleDeskPackageDto: UpdateStyleDeskPackageDto) {
    const pkg = await this.findOne(id);

    if (updateStyleDeskPackageDto.popular === true) {
      await this.packageRepository
        .createQueryBuilder()
        .update(StyleDeskPackage)
        .set({ popular: false })
        .where('id != :id', { id })
        .execute();
    }

    this.packageRepository.merge(pkg, updateStyleDeskPackageDto);
    return this.packageRepository.save(pkg);
  }

  async remove(id: string) {
    const pkg = await this.findOne(id);
    return this.packageRepository.remove(pkg);
  }

  async bookPackage(packageId: string, bookingData: Omit<CreateAppointmentDto, 'services'>) {
    const pkg = await this.findOne(packageId);

    const appointmentDto: CreateAppointmentDto = {
      ...bookingData,
      source: bookingData.source || 'Package Booking',
      // Do not dump features into services — that collides with mixed package+service bookings
      services: [],
      isPackage: true,
      packageName: pkg.title,
    };

    return this.appointmentsService.create(appointmentDto);
  }
}
