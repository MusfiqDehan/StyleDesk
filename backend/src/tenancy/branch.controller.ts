import { Controller, Get, Post, Patch, Body, Param, Req, ForbiddenException, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity.js';
import { Public } from '../auth/public.decorator.js';
import { scopedManager, requireScope } from './tenant-context.js';
import { AppointmentSetting } from '../appointment-setting/entities/appointment-setting.entity.js';
import { InvoiceSetting } from '../invoice-setting/entities/invoice-setting.entity.js';
import { IsString, Matches, Length, IsOptional, IsBoolean } from 'class-validator';
class CreateBranch {
  @IsString() @Length(1, 120) name: string;
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @Length(1, 63) slug: string;
}
class UpdateBranch {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
@Controller('branches')
export class BranchController {
  constructor(@InjectRepository(Branch) private readonly branches: Repository<Branch>) {}
  @Public() @Get('public') publicBranches() { return this.branches.find({ where: { active: true }, order: { slug: 'ASC' }, select: { id: true, name: true, slug: true } }); }
  @Get() list(@Req() req: any) { return this.branches.find({ order: { slug: 'ASC' }, where: req.user.role === 'admin' || req.user.branchScope === 'tenant' || req.user.role === 'customer' ? {} : { id: req.user.branchId } }); }
  @Post() async create(@Req() req: any, @Body() dto: CreateBranch) {
    if (req.user.role !== 'admin' && req.user.branchScope !== 'tenant') throw new ForbiddenException();
    const branch = await this.branches.save(this.branches.create(dto));
    const manager = scopedManager();
    await manager.query("SELECT set_config('app.branch_id', $1, true)", [branch.id]);
    requireScope().branchId = branch.id;
    await manager.save(AppointmentSetting, manager.create(AppointmentSetting, {}));
    await manager.save(InvoiceSetting, manager.create(InvoiceSetting, {}));
    return branch;
  }
  @Patch(':id') async update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranch) {
    if (req.user.role !== 'admin' && req.user.branchScope !== 'tenant') throw new ForbiddenException();
    const branch = await this.branches.findOneByOrFail({ id });
    if (dto.active === false && await this.branches.countBy({ active: true }) === 1 && branch.active) throw new BadRequestException('Keep at least one active branch');
    Object.assign(branch, dto); return this.branches.save(branch);
  }
}
