import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiCookieAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service.js';
import { CreateAppointmentDto } from './dto/create-appointment.dto.js';
import { UpdateAppointmentDto } from './dto/update-appointment.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';

@ApiTags('Appointments')
@ApiCookieAuth('accessToken')
@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) { }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Book a new appointment (public)' })
  @ApiResponse({ status: 201, description: 'Appointment created.' })
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'List appointments with optional filters and pagination' })
  @ApiQuery({ name: 'date', required: false, example: '2024-06-15' })
  @ApiQuery({ name: 'source', required: false, example: 'walk-in' })
  @ApiQuery({ name: 'status', required: false, example: 'pending' })
  @ApiQuery({ name: 'phone', required: false, example: '01785720927' })
  @ApiQuery({ name: 'staff', required: false, example: 'John' })
  @ApiQuery({ name: 'month', required: false, example: 5 })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Paginated list of appointments.' })
  findAll(
    @Query('date') date?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('phone') phone?: string,
    @Query('staff') staff?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.appointmentsService.findAll(
      { date, source, status, phone, staff, month: month ? parseInt(month, 10) : undefined, year: year ? parseInt(year, 10) : undefined },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get(':phone')
  @ApiOperation({ summary: 'Get appointments by client phone number' })
  @ApiParam({ name: 'phone', description: 'Bangladeshi phone number' })
  @ApiResponse({ status: 200, description: 'Appointments for the given phone.' })
  findOne(@Param('phone') phone: string) {
    return this.appointmentsService.findOne(phone);
  }

  @Patch('id/:id')
  @ApiOperation({ summary: 'Update a single appointment by ID' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment updated.' })
  updateById(@Param('id', ParseUUIDPipe) id: string, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentsService.updateById(id, updateAppointmentDto);
  }

  @Patch(':phone')
  @ApiOperation({ summary: 'Update an appointment by phone number' })
  @ApiParam({ name: 'phone', description: 'Bangladeshi phone number' })
  @ApiResponse({ status: 200, description: 'Appointment updated.' })
  update(@Param('phone') phone: string, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    return this.appointmentsService.update(phone, updateAppointmentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an appointment by UUID' })
  @ApiParam({ name: 'id', description: 'Appointment UUID' })
  @ApiResponse({ status: 200, description: 'Appointment deleted.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.remove(id);
  }
}
