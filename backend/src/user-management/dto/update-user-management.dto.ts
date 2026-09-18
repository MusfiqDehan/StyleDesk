import { PartialType } from '@nestjs/mapped-types';
import { CreateUserManagementDto } from './create-user-management.dto.js';

export class UpdateUserManagementDto extends PartialType(CreateUserManagementDto) {}
