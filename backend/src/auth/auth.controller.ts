import { ForbiddenException } from '@nestjs/common';
import { requireScope } from '../tenancy/tenant-context.js';
import { ScopedDataSource } from '../tenancy/scoped-orm.module.js';
import { EmailDto, EmailCodeDto, PublicLoginDto, ResetPasswordDto } from './dto/auth-request.dto.js';
import { Controller, Post, Body, Res, Patch, Req, UseGuards, Get, HttpCode, HttpStatus, ConflictException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth } from '@nestjs/swagger';
import { Throttle, hours, minutes } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';
import { CreateUserManagementDto } from '../user-management/dto/create-user-management.dto.js';
import type { Response, Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    useremail: string;
    role: string;
    permissions: string[];
    employeeId: string | null;
    employeeName: string | null;
    name: string | null;
    isCustomer: boolean;
  };
}
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { Roles } from './roles.decorator.js';
import { Auth, UserRole } from './entities/auth.entity.js';
import { PermissionsGuard } from './permissions.guard.js';
import { Permissions } from './permissions.decorator.js';
import { Public } from './public.decorator.js';
import { CustomerRegisterDto } from './dto/customer-register.dto.js';
import { ClientsService } from '../clients/clients.service.js';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Client } from '../clients/entities/client.entity.js';

const DEFAULT_JWT_EXPIRES_IN = '1d';
const DURATION_UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses simple JWT-style duration strings ("1d", "12h", "30m", "45s", "500ms"). */
function parseDurationMs(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return null;
  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNIT_MS[unit];
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly clientsService: ClientsService,
    private readonly dataSource: ScopedDataSource,
    private readonly configService: ConfigService,
  ) { }

  /**
   * The accessToken cookie must never outlive the JWT it carries — otherwise the
   * browser keeps sending/holding a token the server already rejects as expired for
   * however long the gap is (was hardcoded to 10 days vs. a 1-day JWT `exp`).
   */
  private accessCookieMaxAgeMs(): number {
    const configured = this.configService.get<string>('JWT_ACCESSTOKEN_EXPIRES_IN') ?? DEFAULT_JWT_EXPIRES_IN;
    return parseDurationMs(configured) ?? parseDurationMs(DEFAULT_JWT_EXPIRES_IN)!;
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOM)
  @Permissions('user-management')
  @Post('register')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Register a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async register(@Body() registerDto: CreateUserManagementDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Post('customer-signup')
  @ApiOperation({ summary: 'Register a new customer from frontend (alias)' })
  @ApiResponse({ status: 201, description: 'Customer registered successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async customerSignup(@Body() registerDto: CustomerRegisterDto) {
    return this.registerCustomer(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Post('customer/register')
  @ApiOperation({ summary: 'Register a new customer from frontend' })
  @ApiResponse({ status: 201, description: 'Customer registered successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  async registerCustomer(@Body() registerDto: CustomerRegisterDto) {
    const [subscription]=await requireScope().runner.query('SELECT tenant_access() AS state');
    if(!(await import('../platform/access.service.js')).subscriptionOpen(subscription.state))throw new ForbiddenException('Customer registration is unavailable');
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    await this.authService.assertSignupEmailVerified(normalizedEmail);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Check if useremail exists in Auth (case-insensitive)
      const existingAuth = await queryRunner.manager.findOne(Auth, { where: { useremail: normalizedEmail } });
      if (existingAuth) {
        throw new ConflictException('This email is already registered');
      }

      // 2. Check if client exists by phone
      let client = await queryRunner.manager.findOne(Client, { where: { phone: registerDto.phone } });

      // 3. If a client with this phone already has an auth account, reject
      if (client) {
        if (client.email?.trim().toLowerCase() !== normalizedEmail) {
          throw new ConflictException('This phone number belongs to an existing client. Please contact the salon to link your account.');
        }
        const existingAuthForClient = await queryRunner.manager.findOne(Auth, { where: { clientId: client.id } });
        if (existingAuthForClient) {
          throw new ConflictException('This phone number is already registered');
        }
      }

      // 4. Create client if not exists
      if (!client) {
        client = queryRunner.manager.create(Client, {
          name: registerDto.name,
          phone: registerDto.phone,
          email: normalizedEmail,
        });
        client = await queryRunner.manager.save(client);
      }

      // 5. Create auth
      const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10');
      const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

      const auth = queryRunner.manager.create(Auth, {
        useremail: normalizedEmail,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
        clientId: client.id,
      });
      const savedAuth = await queryRunner.manager.save(auth);

      await queryRunner.commitTransaction();
      this.authService.clearSignupVerification(normalizedEmail);

      return {
        id: savedAuth.id,
        useremail: savedAuth.useremail,
        role: savedAuth.role,
        clientId: savedAuth.clientId,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Post('public-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Public login for customers and staff from the frontend' })
  async publicLogin(
    @Body() body: PublicLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login({ useremail: body.email, password: body.password });
    const isCustomer = result.user.role === 'customer';

    let phone: string | null = null;
    if (isCustomer && result.user.clientId) {
      try {
        const client = await this.clientsService.findById(result.user.clientId);
        phone = client?.phone ?? null;
      } catch { /* client not found, phone stays null */ }
    }

    const secureCookie = process.env.NODE_ENV === 'production';

    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'strict',
      maxAge: this.accessCookieMaxAgeMs(),
    });

    return {
      accessToken: result.accessToken,
      user: {
        ...result.user,
        isCustomer,
        phone: phone ?? (result.user as any).phone ?? null,
      },
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @Post('login')
  @ApiOperation({ summary: 'Log in and receive an access token cookie' })
  @ApiResponse({ status: 200, description: 'Login successful, accessToken cookie set.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto);

    const secureCookie = process.env.NODE_ENV === 'production';

    // Set cookie automatically — lifetime mirrors the JWT's own exp so the browser
    // never holds an already-expired token (see accessCookieMaxAgeMs()).
    response.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'strict',
      maxAge: this.accessCookieMaxAgeMs(),
    });

    return result;
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Log out and clear the access token cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('accessToken');
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update-password')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Update the current user\'s password' })
  @ApiResponse({ status: 200, description: 'Password updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updatePassword(
    @Body() updatePasswordDto: UpdatePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = request.user.id;
    return this.authService.updatePassword(userId, updatePasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('update-profile')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: "Update the current user's display name and/or phone" })
  @ApiResponse({ status: 200, description: 'Profile updated, new token returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async updateProfile(
    @Body() body: { name?: string; phone?: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.updateProfile(request.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @Post('send-email-change-code')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Send OTP to a new email before changing login email' })
  @ApiResponse({ status: 200, description: 'OTP sent to the new email.' })
  async sendEmailChangeCode(
    @Body() body: EmailDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.sendEmailChangeCode(request.user.id, body.email);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('confirm-email-change')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Verify OTP and update login email' })
  @ApiResponse({ status: 200, description: 'Email updated, new token returned.' })
  async confirmEmailChange(
    @Body() body: EmailCodeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.confirmEmailChange(request.user.id, body.email, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Get current user details' })
  @ApiResponse({ status: 200, description: 'User details returned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMe(@Req() request: AuthenticatedRequest) {
    const userId = request.user.id;
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOM)
  @Permissions('user-management')
  @Get('users')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'List all users (Admin/Custom with permission only)' })
  @ApiResponse({ status: 200, description: 'List of users returned.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async getAllUsers(@Req() req: any) {
    return this.authService.findAllUsers(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('customer-dashboard')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Get current customer dashboard data' })
  @ApiResponse({ status: 200, description: 'Customer details with appointments and invoices.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getCustomerDashboard(@Req() request: any) {
    const authRecord = await this.authService.getMe(request.user.id);
    if (!authRecord.clientId) {
      return { name: '', email: '', phone: '', bookings: [] };
    }
    const dashboard = await this.authService.getCustomerDashboard(authRecord.clientId);
    return { ...dashboard, email: authRecord.useremail };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @Post('send-signup-code')
  @ApiOperation({ summary: 'Send OTP for customer signup' })
  async sendSignupCode(@Body() body: { email: string; phone?: string }) {
    return this.authService.sendSignupCode(body.email, body.phone);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('verify-signup-code')
  @ApiOperation({ summary: 'Verify OTP for customer signup' })
  async verifySignupCode(@Body() body: EmailCodeDto) {
    return this.authService.verifySignupCode(body.email, body.code);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @Post('send-reset-code')
  @ApiOperation({ summary: 'Send password reset code to email' })
  async sendResetCode(@Body() body: EmailDto) {
    return this.authService.sendResetCode(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
  @Post('verify-reset-code')
  @ApiOperation({ summary: 'Verify password reset code' })
  async verifyResetCode(@Body() body: EmailCodeDto) {
    return this.authService.verifyResetCode(body.email, body.code);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using verified code' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }
}
