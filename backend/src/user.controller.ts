import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { Roles } from './auth/roles.decorator.js';
import { UserRole } from './auth/entities/auth.entity.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STORE_MANAGER)
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Post()
    async create(
        @Body() body: { email: string; name: string },
    ): Promise<User> {
        return this.userService.create(body.email, body.name);
    }

    @Get()
    async findAll(): Promise<User[]> {
        return this.userService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<User | null> {
        return this.userService.findOne(id);
    }
}
