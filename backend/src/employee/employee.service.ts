import { cursorQueryRows } from '../common/pagination/cursor-query.js';
import { ScopedDataSource } from '../tenancy/scoped-orm.module.js';
import { Injectable, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee, EmployeeRole, EmployeeStatus } from './entities/employee.entity';
import { ARTIST_EMPLOYEE_ROLES, isArtistEmployeeRole } from './employee-role.utils.js';
import { Payroll, PayrollStatus } from '../payroll/entities/payroll.entity.js';
import { uploadLocalImage, deleteLocalFile } from '../common/multer.js';
import { PayrollService } from '../payroll/payroll.service.js';
import { DeviceUserService } from '../biometric/device-user.service.js';

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Payroll)
    private readonly payrollRepository: Repository<Payroll>,
    private readonly dataSource: ScopedDataSource,
    @Inject(forwardRef(() => PayrollService))
    private readonly payrollService: PayrollService,
    @Inject(forwardRef(() => DeviceUserService))
    private readonly deviceUserService: DeviceUserService,
  ) {}

  async create(createEmployeeDto: CreateEmployeeDto, file?: Express.Multer.File) {
    if (file) {
      createEmployeeDto.image = await uploadLocalImage(file.buffer, 'StyleDesk/employees');
    }
    return this.dataSource.transaction(async (manager) => {
      // 1. Create and save the employee
      const employee = manager.create(Employee, createEmployeeDto);
      const savedEmployee = await manager.save(Employee, employee);

      // 2. Automatically create the first payroll record for this employee
      const now = new Date();
      const baseSalary = Number(savedEmployee.salary) || 0;
      
      const payroll = manager.create(Payroll, {
        employee: savedEmployee,
        employeeId: savedEmployee.id,
        employeeName: savedEmployee.name,
        role: savedEmployee.role === EmployeeRole.OTHER ? (savedEmployee.customRole || savedEmployee.role) : savedEmployee.role,
        baseSalary,
        bonus: 0,
        deductions: 0,
        netSalary: baseSalary,
        status: PayrollStatus.PENDING,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });

      await manager.save(Payroll, payroll);

      return savedEmployee;
    });
  }

  findAll(name?: string) {
    const qb = this.employeeRepository.createQueryBuilder('employee');
    const trimmedName = name?.trim();
    if (trimmedName) qb.andWhere('employee.name ILIKE :name', { name: `%${trimmedName}%` });
    return cursorQueryRows(qb, ["/employee", "/employee/active", "/employee/artists"]);
  }

  findBasic(id?: string) {
    const qb = this.employeeRepository
      .createQueryBuilder('employee')
      .select([
        'employee.id',
        'employee.name',
        'employee.role',
        'employee.customRole',
        'employee.specializations',
        'employee.experience',
        'employee.image',
        'employee.about',
        'employee.salary',
        'employee.status',
      ]);

    if (id && id !== 'undefined' && id !== 'null' && id !== 'employees-basic') {
      qb.where('employee.id = :id', { id });
    }

    return qb.getMany();
  }

  findByRole(role: EmployeeRole) {
    return this.employeeRepository.find({ where: { role, status: EmployeeStatus.ACTIVE } });
  }

  findStylists() {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .andWhere('employee.role IN (:...roles)', { roles: [...ARTIST_EMPLOYEE_ROLES] })
      .getMany();
  }

  findAssistants() {
    return this.findByRole(EmployeeRole.ASSISTANT);
  }

  async findOne(id: string) {
    const employee = await this.employeeRepository.findOne({ where: { id } });
    if (!employee) throw new NotFoundException(`Employee #${id} not found`);
    return employee;
  }

  async validateStylist(id: string): Promise<Employee> {
    const employee = await this.findOne(id);
    if (!isArtistEmployeeRole(employee.role) || employee.status !== EmployeeStatus.ACTIVE) {
      throw new NotFoundException(`Employee #${id} is not an active Artist`);
    }
    return employee;
  }

  async validateStylistByName(name: string): Promise<Employee> {
    const employee = await this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.name = :name', { name })
      .andWhere('employee.status = :status', { status: EmployeeStatus.ACTIVE })
      .andWhere('employee.role IN (:...roles)', { roles: [...ARTIST_EMPLOYEE_ROLES] })
      .getOne();
    if (!employee) throw new NotFoundException(`No active Artist found with name: ${name}`);
    return employee;
  }

  async validateEmployeeByName(name: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { name, status: EmployeeStatus.ACTIVE } });
    if (!employee) throw new NotFoundException(`No active employee found with name: ${name}`);
    return employee;
  }

  async findByNameForCommission(name: string): Promise<Employee | null> {
    return this.employeeRepository
      .createQueryBuilder('employee')
      .where('employee.name ILIKE :name', { name: name.trim() })
      .getOne();
  }

  async validateAssistant(id: string): Promise<Employee> {
    const employee = await this.findOne(id);
    if (employee.role !== EmployeeRole.ASSISTANT || employee.status !== EmployeeStatus.ACTIVE) {
      throw new NotFoundException(`Employee #${id} is not an active Assistant`);
    }
    return employee;
  }

  async validateAssistantByName(name: string): Promise<Employee> {
    const employee = await this.employeeRepository.findOne({ where: { name, role: EmployeeRole.ASSISTANT, status: EmployeeStatus.ACTIVE } });
    if (!employee) throw new NotFoundException(`No active Assistant found with name: ${name}`);
    return employee;
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto, file?: Express.Multer.File) {
    const employee = await this.findOne(id);
    if (file) {
      if (employee.image) {
        await deleteLocalFile(employee.image).catch(err =>
          console.error(`Failed to delete old image ${employee.image}:`, err)
        );
      }
      updateEmployeeDto.image = await uploadLocalImage(file.buffer, 'StyleDesk/employees');
    } else if (updateEmployeeDto.image === null || updateEmployeeDto.image === '') {
      // If image was removed
      if (employee.image) {
        await deleteLocalFile(employee.image).catch(err =>
          console.error(`Failed to delete old image ${employee.image}:`, err)
        );
      }
    }
    
    Object.assign(employee, updateEmployeeDto);
    const saved = await this.employeeRepository.save(employee);

    // Sync payroll records if name, role, customRole, or salary changed
    const dataChanged = 
      updateEmployeeDto.name !== undefined || 
      updateEmployeeDto.role !== undefined || 
      updateEmployeeDto.customRole !== undefined || 
      updateEmployeeDto.salary !== undefined;

    if (dataChanged) {
      await this.payrollService.syncEmployeeDataInPayrolls(saved);
    }

    return saved;
  }

  async remove(id: string) {
    const employee = await this.findOne(id);
    await this.deviceUserService.purgeEmployeeFromDevice(id);
    if (employee.image) {
      await deleteLocalFile(employee.image);
    }
    const removed = await this.employeeRepository.remove(employee);
    // Payroll rows go with the employee via ON DELETE CASCADE, so their Employee Salary
    // & Bonus expenses have to be cleared here — no payroll delete hook ever runs.
    await this.payrollService.reconcileFinanceExpenses();
    return removed;
  }
}
