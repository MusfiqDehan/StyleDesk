import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StyleDeskPackagesService } from './StyleDesk-packages.service';
import { CreateStyleDeskPackageDto } from './dto/create-StyleDesk-package.dto';
import { UpdateStyleDeskPackageDto } from './dto/update-StyleDesk-package.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { UserRole } from '../auth/entities/auth.entity';
import { Public } from '../auth/public.decorator';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { uploadLocalImage } from '../common/multer';

@Controller('StyleDesk-packages')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StyleDeskPackagesController {
  constructor(private readonly StyleDeskPackagesService: StyleDeskPackagesService) {}

  @Post('upload-image')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('StyleDesk-packages')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      cb(null, /image\/(jpeg|png|webp|avif)/.test(file.mimetype))
    },
  }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const imageUrl = await uploadLocalImage(file.buffer, 'StyleDesk/packages');
    return { imageUrl };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('StyleDesk-packages')
  create(@Body() createStyleDeskPackageDto: CreateStyleDeskPackageDto) {
    return this.StyleDeskPackagesService.create(createStyleDeskPackageDto);
  }

  @Public()
  @Get()
  findAll() {
    return this.StyleDeskPackagesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.StyleDeskPackagesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('StyleDesk-packages')
  update(@Param('id') id: string, @Body() updateStyleDeskPackageDto: UpdateStyleDeskPackageDto) {
    return this.StyleDeskPackagesService.update(id, updateStyleDeskPackageDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOM)
  @Permissions('StyleDesk-packages')
  remove(@Param('id') id: string) {
    return this.StyleDeskPackagesService.remove(id);
  }

  @Public()
  @Post('book/:id')
  bookPackage(
    @Param('id') id: string,
    @Body() bookingData: Omit<CreateAppointmentDto, 'services'>,
  ) {
    return this.StyleDeskPackagesService.bookPackage(id, bookingData);
  }
}
