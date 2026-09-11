import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto';

// fingerprintCode is intentionally excluded from the update DTO.
// It is managed exclusively by the biometric link/unlink/delete endpoints
// and must never be settable through the general employee update path.
export class UpdateEmployeeDto extends PartialType(OmitType(CreateEmployeeDto, ['fingerprintCode'] as const)) {}
