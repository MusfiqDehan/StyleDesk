import { Optional } from '@nestjs/common';
import { TenantCron, TenantJobs } from '../tenancy/tenant-jobs.js';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll, PayrollStatus } from './entities/payroll.entity.js';
import { Employee, EmployeeStatus } from '../employee/entities/employee.entity.js';

@Injectable()
export class PayrollScheduler {
  private readonly logger = new Logger(PayrollScheduler.name);

  constructor(
    @InjectRepository(Payroll)
    private readonly payrollRepo: Repository<Payroll>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @Optional() private readonly tenantJobs?: TenantJobs,
  ) {}

  // Runs at 00:00 on the 1st of every month
  @TenantCron('0 0 1 * *')
  async generateMonthlyPayroll() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    this.logger.log(`Generating payroll entries for ${month}/${year}`);

    const employees = await this.employeeRepo.find({
      where: { status: EmployeeStatus.ACTIVE },
    });

    let created = 0;
    for (const employee of employees) {
      const existing = await this.payrollRepo.findOne({
        where: { employeeId: employee.id, month, year },
      });
      if (existing) continue;

      const baseSalary = Number(employee.salary) || 0;
      await this.payrollRepo.save(
        this.payrollRepo.create({
          employeeId: employee.id,
          employeeName: employee.name,
          role: employee.role,
          baseSalary,
          bonus: 0,
          deductions: 0,
          netSalary: baseSalary,
          status: PayrollStatus.PENDING,
          month,
          year,
        }),
      );
      created++;
    }

    this.logger.log(`Payroll generation done: ${created} new entries for ${month}/${year}`);
  }
}
