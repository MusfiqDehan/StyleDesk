import { ForbiddenException } from '@nestjs/common';
import { persistSecurityFailure, requireScope } from '../tenancy/tenant-context.js';
import { randomInt } from 'node:crypto';
import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth, UserRole } from './entities/auth.entity.js';
import { Client } from '../clients/entities/client.entity.js';
import { Employee } from '../employee/entities/employee.entity.js';
import { RolePermission } from '../role-permission/entities/role-permission.entity.js';
import {
  ALL_MODULE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  EDITABLE_ROLES,
} from '../role-permission/role-permission.defaults.js';
import type { EditableRole } from '../role-permission/entities/role-permission.entity.js';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { ConfigService } from '@nestjs/config';
import { ServiceService } from '../service/service.service.js';
import { MailService } from '../mail/mail.service.js';

type RegisterInput = {
  useremail: string;
  password: string;
  role?: UserRole;
  employeeId?: string;
  clientId?: string;
};

@Injectable()
export class AuthService {
  private static readonly OTP_MAX_ATTEMPTS = 5;

  private readonly signupOtpStore = new Map<
    string,
    { code: string; expiresAt: number; verified: boolean; attempts: number }
  >();

  /** Keyed by `${authId}:${newEmail}` — OTP is sent to the new address. */
  private readonly emailChangeOtpStore = new Map<
    string,
    { code: string; expiresAt: number; attempts: number }
  >();

  constructor(
    @InjectRepository(Auth)
    private readonly authRepository: Repository<Auth>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly serviceService: ServiceService,
    private readonly mailService: MailService,
  ) { }

  async resolveEffectivePermissions(
    role: UserRole,
    customPermissions?: string[] | null,
  ): Promise<string[]> {
    if (role === UserRole.ADMIN) return [...ALL_MODULE_PERMISSIONS];
    if (role === UserRole.CUSTOM) return [...(customPermissions || [])];
    if (role === UserRole.CUSTOMER) return [];
    if (EDITABLE_ROLES.includes(role as EditableRole)) {
      const row = await this.rolePermissionRepository.findOne({
        where: { role: role as EditableRole },
      });
      if (row) return [...row.permissions];
      return [...DEFAULT_ROLE_PERMISSIONS[role as EditableRole]];
    }
    return [];
  }

  private async buildAccessTokenPayload(auth: Auth) {
    const permissions = await this.resolveEffectivePermissions(
      auth.role,
      auth.permissions,
    );
    return {
      tenantId: auth.tenantId,
      branchId: auth.branchId,
      useremail: auth.useremail,
      role: auth.role,
      id: auth.id,
      permissions,
      tokenVersion: auth.tokenVersion ?? 0,
      employeeId: auth.employeeId ?? null,
      employeeName: auth.employee?.name ?? null,
      clientId: auth.clientId ?? null,
      clientName: auth.client?.name ?? null,
      name: auth.client?.name ?? auth.employee?.name ?? null,
      phone: auth.client?.phone ?? null,
      isCustomer: auth.role === UserRole.CUSTOMER,
    };
  }

  async register(_dto: any) { throw new ForbiddenException('Staff accounts are invite-only'); }

  async login(loginDto: LoginDto) {
    const { useremail, password } = loginDto;
    const auth = await this.authRepository.findOne({
      where: { useremail },
      relations: { employee: true, client: true },
    });

    if (!auth || !auth.active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, auth.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = await this.buildAccessTokenPayload(auth);

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: auth.id,
        tenantId: auth.tenantId,
      branchId: auth.branchId,
      useremail: auth.useremail,
        role: auth.role,
        permissions: payload.permissions,
        employeeId: auth.employeeId ?? null,
        employeeName: auth.employee?.name ?? null,
        clientId: auth.clientId ?? null,
        clientName: auth.client?.name ?? null,
        name: auth.client?.name ?? auth.employee?.name ?? null,
        phone: auth.client?.phone ?? null,
        createdAt: auth.createdAt,
        updatedAt: auth.updatedAt,
      },
    };
  }

  async findAllUsers(actor?: any) {
    return this.authRepository.find({
      where: actor && actor.role !== UserRole.ADMIN && actor.branchScope !== 'tenant' ? {branchId:actor.branchId} : {},
      select: { id: true, useremail: true, role: true, permissions: true, employeeId: true, createdAt: true, updatedAt: true },
      relations: { employee: true },
    });
  }

  async updatePassword(authId: string, updatePasswordDto: UpdatePasswordDto) {
    const { oldPassword, newPassword } = updatePasswordDto;
    const auth = await this.authRepository.findOne({ where: { id: authId } });

    if (!auth) {
      throw new NotFoundException('Auth record not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, auth.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid old password');
    }

    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10');
    auth.password = await bcrypt.hash(newPassword, saltRounds);
    auth.tokenVersion = (auth.tokenVersion ?? 0) + 1;
    await this.authRepository.save(auth);

    return { message: 'Password updated successfully' };
  }

  async updateProfile(authId: string, body: { name?: string; phone?: string }) {
    const name = body.name?.trim() || '';
    const phone = body.phone?.trim() || '';

    if (!name && !phone) {
      throw new BadRequestException('Name or phone is required');
    }

    if (phone && !/^(?:(?:\+?88)?01[3-9]\d{8}|1[3-9]\d{8})$/.test(phone)) {
      throw new BadRequestException('Phone must be a valid Bangladeshi number');
    }

    const auth = await this.authRepository.findOne({
      where: { id: authId },
      relations: { employee: true, client: true },
    });
    if (!auth) throw new NotFoundException('User not found');

    const isAdmin = auth.role === UserRole.ADMIN;

    // Prefer updating linked client (booking contact). Create one for Admin when missing.
    if (auth.clientId && auth.client) {
      if (name) auth.client.name = name;
      if (phone) {
        const existing = await this.clientRepository.findOne({ where: { phone } });
        if (existing && existing.id !== auth.client.id) {
          throw new ConflictException('An account with this phone number already exists');
        }
        auth.client.phone = phone;
      }
      await this.clientRepository.save(auth.client);
    } else if (isAdmin && name && phone) {
      const existingByPhone = await this.clientRepository.findOne({ where: { phone } });
      if (existingByPhone) {
        const linkedAuth = await this.authRepository.findOne({
          where: { clientId: existingByPhone.id },
        });
        if (linkedAuth && linkedAuth.id !== auth.id) {
          throw new ConflictException('An account with this phone number already exists');
        }
        existingByPhone.name = name;
        existingByPhone.phone = phone;
        if (!existingByPhone.email) existingByPhone.email = auth.useremail;
        await this.clientRepository.save(existingByPhone);
        auth.clientId = existingByPhone.id;
        auth.client = existingByPhone;
        await this.authRepository.save(auth);
      } else {
        const client = this.clientRepository.create({
          name,
          phone,
          email: auth.useremail,
        });
        const savedClient = await this.clientRepository.save(client);
        auth.clientId = savedClient.id;
        auth.client = savedClient;
        await this.authRepository.save(auth);
      }
    } else if (auth.employeeId && auth.employee && name) {
      auth.employee.name = name;
      await this.employeeRepository.save(auth.employee);
    } else if (name) {
      // No client/employee to persist — reject so callers don't think it saved
      throw new BadRequestException(
        auth.role === UserRole.ADMIN
          ? 'Add a phone number on Update Password first, then you can change your name here'
          : 'Unable to save profile for this account type',
      );
    }

    // Keep employee display name in sync for admin if linked
    if (auth.employeeId && auth.employee && name) {
      auth.employee.name = name;
      await this.employeeRepository.save(auth.employee);
    }

    const payload = await this.buildAccessTokenPayload(auth);
    // Preserve customer name/phone overrides from this update
    payload.name = auth.client?.name || auth.employee?.name || name || null;
    payload.phone = auth.client?.phone || phone || null;
    payload.employeeName =
      auth.role === UserRole.CUSTOMER
        ? null
        : (auth.employee?.name ?? payload.name);

    return {
      name: payload.name,
      phone: payload.phone,
      accessToken: this.jwtService.sign(payload),
    };
  }

  private emailChangeOtpKey(authId: string, email: string) {
    return `${authId}:${email.trim().toLowerCase()}`;
  }

  async sendEmailChangeCode(authId: string, newEmail: string) {
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestException('Enter a valid email address');
    }

    const auth = await this.authRepository.findOne({ where: { id: authId } });
    if (!auth) throw new NotFoundException('User not found');

    if (auth.useremail.trim().toLowerCase() === normalizedEmail) {
      throw new BadRequestException('New email must be different from your current email');
    }

    const emailTaken = await this.authRepository.findOne({ where: { useremail: normalizedEmail } });
    if (emailTaken) throw new ConflictException('This email is already registered');

    const clientTaken = await this.clientRepository.findOne({ where: { email: normalizedEmail } });
    if (clientTaken && clientTaken.id !== auth.clientId) {
      throw new ConflictException('This email is already registered');
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    this.emailChangeOtpStore.set(this.emailChangeOtpKey(authId, normalizedEmail), {
      code,
      expiresAt,
      attempts: 0,
    });

    await this.mailService.sendEmailChangeOtp(normalizedEmail, code);
    return { message: 'OTP sent to your new email' };
  }

  async confirmEmailChange(authId: string, newEmail: string, code: string) {
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Email is required');

    const key = this.emailChangeOtpKey(authId, normalizedEmail);
    const record = this.emailChangeOtpStore.get(key);
    if (!record) throw new BadRequestException('No OTP found. Please request a new one');
    if (Date.now() > record.expiresAt) {
      this.emailChangeOtpStore.delete(key);
      throw new BadRequestException('OTP has expired');
    }
    if (record.code !== String(code ?? '').trim()) {
      const attempts = (record.attempts ?? 0) + 1;
      if (attempts >= AuthService.OTP_MAX_ATTEMPTS) {
        this.emailChangeOtpStore.delete(key);
        throw new BadRequestException('Too many invalid attempts. Please request a new code');
      }
      this.emailChangeOtpStore.set(key, { ...record, attempts });
      throw new BadRequestException('Invalid OTP');
    }

    const auth = await this.authRepository.findOne({
      where: { id: authId },
      relations: { employee: true, client: true },
    });
    if (!auth) throw new NotFoundException('User not found');

    if (auth.useremail.trim().toLowerCase() === normalizedEmail) {
      this.emailChangeOtpStore.delete(key);
      throw new BadRequestException('New email must be different from your current email');
    }

    const emailTaken = await this.authRepository.findOne({ where: { useremail: normalizedEmail } });
    if (emailTaken && emailTaken.id !== auth.id) {
      throw new ConflictException('This email is already registered');
    }

    auth.useremail = normalizedEmail;
    await this.authRepository.save(auth);

    if (auth.client) {
      auth.client.email = normalizedEmail;
      await this.clientRepository.save(auth.client);
    }

    this.emailChangeOtpStore.delete(key);

    const payload = await this.buildAccessTokenPayload(auth);

    return {
      tenantId: auth.tenantId,
      branchId: auth.branchId,
      useremail: auth.useremail,
      accessToken: this.jwtService.sign(payload),
      message: 'Email updated successfully',
    };
  }

  async getMe(id: string) {
    const auth = await this.authRepository.findOne({
      where: { id },
      relations: { employee: true, client: true },
    });

    if (!auth) {
      throw new NotFoundException('User not found');
    }

    const permissions = await this.resolveEffectivePermissions(
      auth.role,
      auth.permissions,
    );

    return {
      id: auth.id,
      tenantId: auth.tenantId,
      branchId: auth.branchId,
      useremail: auth.useremail,
      role: auth.role,
      permissions,
      employeeId: auth.employeeId ?? null,
      employeeName: auth.employee?.name ?? null,
      clientId: auth.clientId ?? null,
      clientName: auth.client?.name ?? null,
      name: auth.client?.name ?? auth.employee?.name ?? null,
      phone: auth.client?.phone ?? null,
      createdAt: auth.createdAt,
      updatedAt: auth.updatedAt,
    };
  }

  async publicLogin(email: string, password: string) {
    // 1. Check auth table first (staff / admin / manager accounts)
    const authUser = await this.authRepository.findOne({
      where: { useremail: email },
      relations: { employee: true, client: true },
    });

    if (authUser) {
      if (!authUser.active) throw new UnauthorizedException('Account deactivated');
      const valid = await bcrypt.compare(password, authUser.password);
      if (!valid) throw new UnauthorizedException('Invalid credentials');

      const payload = await this.buildAccessTokenPayload(authUser);

      return {
        accessToken: this.jwtService.sign(payload),
        user: {
          id: authUser.id,
          email: authUser.useremail,
          role: authUser.role,
          permissions: payload.permissions,
          name: payload.name,
          phone: payload.phone,
          clientId: authUser.clientId ?? null,
          clientName: authUser.client?.name ?? null,
          isCustomer: false,
        },
      };
    }

    // 2. Fall back to clients table (customers)
    const client = await this.clientRepository
      .createQueryBuilder('client')
      .addSelect('client.password')
      .where('LOWER(client.email) = LOWER(:email)', { email })
      .getOne();

    if (!client) throw new UnauthorizedException('Invalid credentials');
    if (!client.password) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, client.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = {
      id: client.id,
      useremail: client.email,
      role: 'customer',
      permissions: [],
      employeeId: null,
      employeeName: null,
      name: client.name,
      phone: client.phone ?? null,
      isCustomer: true,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: client.id,
        email: client.email,
        role: 'customer',
        name: client.name,
        phone: client.phone ?? null,
        isCustomer: true,
      },
    };
  }

  async getCustomerDashboard(clientId: string) {
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
      relations: { appointments: { invoices: true } },
    });
    if (!client) throw new NotFoundException('Customer not found');

    const appointments = (client.appointments ?? []).sort(
      (a: any, b: any) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime(),
    );

    const bookings = await Promise.all(
      appointments.map(async (apt: any) => {
        const inv = apt.invoices?.[0] ?? null;
        const estimatedTotal = !inv && apt.services?.length
          ? await this.serviceService.calculateTotal(apt.services).catch(() => null)
          : null;
        return {
          id: apt.id,
          date: apt.date,
          time: apt.time,
          appointmentStatus: apt.status,
          services: apt.services ?? [],
          invoiceId: inv?.id ?? null,
          invoiceNumber: inv?.invoiceNumber ?? null,
          staff: inv?.staff ?? apt.staff ?? null,
          total: inv ? Number(inv.total) : estimatedTotal,
          paymentMethod: inv?.paymentMethod ?? null,
          invoiceStatus: inv?.status ?? null,
          invoicedAt: inv?.createdAt ?? null,
        };
      }),
    );

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      bookings,
    };
  }

  async customerSignup(data: { name: string; email: string; phone: string; password: string }) {
    const { name, email, phone, password } = data;

    // Prevent email collision with staff accounts
    const existingAuth = await this.authRepository.findOne({ where: { useremail: email } });
    if (existingAuth) throw new ConflictException('This email is already registered');

    // Prevent duplicate customer accounts by email
    const existingClientByEmail = await this.clientRepository.findOne({ where: { email } });
    if (existingClientByEmail) throw new ConflictException('This email is already registered');

    // Prevent duplicate customer accounts by phone
    const existingClientByPhone = await this.clientRepository.findOne({ where: { phone } });
    if (existingClientByPhone) throw new ConflictException('This phone number is already registered');

    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const client = this.clientRepository.create({ name, email, phone, password: hashedPassword });
    const saved = await this.clientRepository.save(client);

    return { id: saved.id, name: saved.name, email: saved.email, phone: saved.phone };
  }

  async sendSignupCode(email: string, phone?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Email is required');

    const existingAuth = await this.authRepository.findOne({ where: { useremail: normalizedEmail } });
    if (existingAuth) throw new ConflictException('This email is already registered');

    const existingClient = await this.clientRepository.findOne({ where: { email: normalizedEmail } });
    if (existingClient) throw new ConflictException('This email is already registered');

    const normalizedPhone = phone?.trim();
    if (normalizedPhone) {
      const existingByPhone = await this.clientRepository.findOne({ where: { phone: normalizedPhone } });
      if (existingByPhone) throw new ConflictException('This phone number is already registered');
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    this.signupOtpStore.set(`${requireScope().tenantId}:${normalizedEmail}`, { code, expiresAt, verified: false, attempts: 0 });

    await this.mailService.sendSignupOtp(normalizedEmail, code);
    return { message: 'OTP sent to your email' };
  }

  async verifySignupCode(email: string, code: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const record = this.signupOtpStore.get(`${requireScope().tenantId}:${normalizedEmail}`);

    if (!record) throw new BadRequestException('No OTP found. Please request a new one');
    if (Date.now() > record.expiresAt) {
      this.signupOtpStore.delete(`${requireScope().tenantId}:${normalizedEmail}`);
      throw new BadRequestException('OTP has expired');
    }
    if (record.code !== String(code ?? '').trim()) {
      const attempts = (record.attempts ?? 0) + 1;
      if (attempts >= AuthService.OTP_MAX_ATTEMPTS) {
        this.signupOtpStore.delete(`${requireScope().tenantId}:${normalizedEmail}`);
        throw new BadRequestException('Too many invalid attempts. Please request a new code');
      }
      this.signupOtpStore.set(`${requireScope().tenantId}:${normalizedEmail}`, { ...record, attempts });
      throw new BadRequestException('Invalid OTP');
    }

    this.signupOtpStore.set(`${requireScope().tenantId}:${normalizedEmail}`, { ...record, verified: true, attempts: 0 });
    return { message: 'OTP verified successfully' };
  }

  async assertSignupEmailVerified(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const record = this.signupOtpStore.get(`${requireScope().tenantId}:${normalizedEmail}`);

    if (!record || !record.verified) {
      throw new BadRequestException('Please verify OTP before creating account');
    }

    if (Date.now() > record.expiresAt) {
      this.signupOtpStore.delete(`${requireScope().tenantId}:${normalizedEmail}`);
      throw new BadRequestException('OTP has expired');
    }
  }

  clearSignupVerification(email: string) {
    this.signupOtpStore.delete(`${requireScope().tenantId}:${email.trim().toLowerCase()}`);
  }

  private async findAuthByEmail(email: string): Promise<Auth | null> {
    const normalized = email.trim().toLowerCase();
    let auth = await this.authRepository.findOne({ where: { useremail: normalized } });
    if (!auth) {
      const client = await this.clientRepository.findOne({ where: { email: normalized } });
      if (client) auth = await this.authRepository.findOne({ where: { clientId: client.id } });
    }
    return auth;
  }

  /** Increments failed OTP attempts; clears the code after OTP_MAX_ATTEMPTS failures. */
  private async failResetCodeAttempt(auth: Auth): Promise<never> {
    persistSecurityFailure();
    const attempts = (auth.resetCodeAttempts ?? 0) + 1;
    if (attempts >= AuthService.OTP_MAX_ATTEMPTS) {
      auth.resetCode = null;
      auth.resetCodeExpiry = null;
      auth.resetCodeAttempts = 0;
      await this.authRepository.save(auth);
      throw new BadRequestException('Too many invalid attempts. Please request a new code');
    }
    auth.resetCodeAttempts = attempts;
    await this.authRepository.save(auth);
    throw new BadRequestException('Invalid verification code');
  }

  async sendResetCode(email: string) {
    const normalized = email.trim().toLowerCase();
    const auth = await this.findAuthByEmail(normalized);
    if (!auth) throw new NotFoundException('No account found with this email');

    const resetCode = randomInt(100000, 1000000).toString();
    auth.resetCode = resetCode;
    auth.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    auth.resetCodeAttempts = 0;
    await this.authRepository.save(auth);

    await this.mailService.sendPasswordResetOtp(normalized, resetCode);
    return { message: 'Reset code sent to email' };
  }

  async verifyResetCode(email: string, code: string) {
    const auth = await this.findAuthByEmail(email);
    if (!auth) throw new NotFoundException('User not found');
    if (!auth.resetCode || !auth.resetCodeExpiry) {
      throw new BadRequestException('No reset code found. Please request a new one');
    }
    if (new Date() > auth.resetCodeExpiry) {
      persistSecurityFailure();
      auth.resetCode = null;
      auth.resetCodeExpiry = null;
      auth.resetCodeAttempts = 0;
      await this.authRepository.save(auth);
      throw new BadRequestException('Verification code has expired');
    }
    if (auth.resetCode !== String(code ?? '').trim()) {
      await this.failResetCodeAttempt(auth);
    }

    return { message: 'Code verified successfully' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const auth = await this.findAuthByEmail(email);
    if (!auth) throw new NotFoundException('User not found');
    if (!auth.resetCode || !auth.resetCodeExpiry) {
      throw new BadRequestException('No reset code found. Please request a new one');
    }
    if (new Date() > auth.resetCodeExpiry) {
      persistSecurityFailure();
      auth.resetCode = null;
      auth.resetCodeExpiry = null;
      auth.resetCodeAttempts = 0;
      await this.authRepository.save(auth);
      throw new BadRequestException('Verification code has expired');
    }
    if (auth.resetCode !== String(code ?? '').trim()) {
      await this.failResetCodeAttempt(auth);
    }

    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10');
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    auth.password = hashed;
    auth.tokenVersion = (auth.tokenVersion ?? 0) + 1;
    auth.resetCode = null;
    auth.resetCodeExpiry = null;
    auth.resetCodeAttempts = 0;
    await this.authRepository.save(auth);

    if (auth.clientId) {
      const client = await this.clientRepository.findOne({ where: { id: auth.clientId } });
      if (client) {
        client.password = hashed;
        await this.clientRepository.save(client);
      }
    }

    return { message: 'Password reset successfully' };
  }
}
