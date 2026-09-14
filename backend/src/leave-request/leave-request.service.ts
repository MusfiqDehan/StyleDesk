import { cursorRequest } from '../common/pagination/cursor.js';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveRequest } from './entities/leave-request.entity';
import { UserRole } from '../auth/entities/auth.entity.js';
import { Employee } from '../employee/entities/employee.entity';

@Injectable()
export class LeaveRequestService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly repo: Repository<LeaveRequest>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  async create(dto: CreateLeaveRequestDto, user: any): Promise<LeaveRequest> {
    const hasFullAccess = 
      user.role === UserRole.ADMIN || 
      user.role === UserRole.STORE_MANAGER || 
      (user.role === UserRole.CUSTOM && user.permissions?.includes('leave-request'));

    let employeeId: string;
    let employeeName: string;

    // If privileged user provides a target employeeId, use it (acting on behalf)
    if (hasFullAccess && dto.employeeId) {
      const employee = await this.employeeRepo.findOne({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException(`Employee #${dto.employeeId} not found`);
      employeeId = employee.id;
      employeeName = employee.name;
    } else {
      // Otherwise, use the login user's own employee link
      if (!user.employeeId) {
        throw new ForbiddenException('No employee record linked to your account. Please contact admin.');
      }
      employeeId = user.employeeId;
      employeeName = user.employeeName;
    }

    const entity = this.repo.create({ ...dto, employeeId, employeeName });
    return this.repo.save(entity);
  }

  async findAll(user: any): Promise<any> {
    const { employeeId, role, permissions } = user;
    const hasFullAccess = 
      role === UserRole.ADMIN || 
      role === UserRole.STORE_MANAGER || 
      (role === UserRole.CUSTOM && permissions?.includes('leave-request'));

    if (hasFullAccess) {
      const requests = await this.repo.find({ order: { createdAt: 'DESC' } });
      if (requests.length === 0) return cursorRequest() ? [] : { message: 'no leave request yet' };
      return requests;
    } else {
      if (!employeeId) return cursorRequest() ? [] : { message: 'no leave request yet' };
      const requests = await this.repo.find({ 
        where: { employeeId }, 
        order: { createdAt: 'DESC' } 
      });
      if (requests.length === 0) return cursorRequest() ? [] : { message: 'no leave request yet' };
      return requests;
    }
  }

  /**
   * `user` is omitted for internal calls from update()/remove() — those endpoints are
   * already restricted to privileged roles at the controller level. When called from
   * the public findOne() endpoint, `user` must be passed so staff/stylist/custom
   * accounts can only read their own leave request, not anyone else's by guessing an id.
   */
  async findOne(id: string, user?: any): Promise<LeaveRequest> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Leave request #${id} not found`);

    if (user) {
      const hasFullAccess =
        user.role === UserRole.ADMIN ||
        user.role === UserRole.STORE_MANAGER ||
        (user.role === UserRole.CUSTOM && user.permissions?.includes('leave-request'));
      if (!hasFullAccess && record.employeeId !== user.employeeId) {
        throw new ForbiddenException('You do not have permission to view this leave request');
      }
    }

    return record;
  }

  async update(id: string, dto: UpdateLeaveRequestDto): Promise<LeaveRequest> {
    const record = await this.findOne(id);
    Object.assign(record, dto);
    return this.repo.save(record);
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.repo.remove(record);
  }
}
