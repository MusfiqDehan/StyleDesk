import { IsString, IsEmail, IsOptional, IsBoolean, IsIn, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const CATALOG_SORT_ORDERS = ['newest', 'oldest', 'price_high', 'price_low'] as const;

// Converts empty strings to undefined so @IsOptional() correctly skips validation
const emptyToUndefined = () =>
  Transform(({ value }) => (value === '' ? undefined : value));

export class CreateBussinessInfoDto {
  @ApiProperty({ example: '#7040c1', required: false, description: 'Six-digit hex brand color' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primaryColor must be a six-digit hex color' })
  primaryColor?: string;

  @ApiProperty({ example: 'StyleDesk', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  businessName?: string;

  @ApiProperty({ example: 'contact@StyleDesk.com', required: false })
  @IsEmail()
  @IsOptional()
  @emptyToUndefined()
  email?: string;

  @ApiProperty({ example: '+880 1711-000000', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  phone?: string;

  @ApiProperty({ example: '123 Dhanmondi Road, Dhaka-1205, Bangladesh', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  address?: string;

  @ApiProperty({ example: 'BIN-000000000-0101', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  gstNumber?: string;

  @ApiProperty({ example: "Let's Plan Your Next Beauty Experience", required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  contactSectionTitle?: string;

  @ApiProperty({ example: 'Reach out for appointments, package consultation, and tailored beauty recommendations.', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  contactSectionDescription?: string;

  @ApiProperty({ example: 'https://www.google.com/maps?q=Mirpur+DOHS,+Dhaka&output=embed', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  mapEmbedUrl?: string;

  @ApiProperty({ example: 'uuid.webp', required: false })
  @IsString()
  @IsOptional()
  @emptyToUndefined()
  logoUrl?: string;

  @ApiProperty({
    example: false,
    required: false,
    description: 'Hide the public marketing website; visitors see the administration login instead.',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return value;
  })
  hideMainWebsite?: boolean;

  @ApiProperty({
    example: 'newest',
    required: false,
    enum: CATALOG_SORT_ORDERS,
    description: 'Sort order for packages on admin + public /packages',
  })
  @IsOptional()
  @IsIn(CATALOG_SORT_ORDERS)
  packagesSortOrder?: (typeof CATALOG_SORT_ORDERS)[number];

  @ApiProperty({
    example: 'newest',
    required: false,
    enum: CATALOG_SORT_ORDERS,
    description: 'Sort order for services on admin + public /services',
  })
  @IsOptional()
  @IsIn(CATALOG_SORT_ORDERS)
  servicesSortOrder?: (typeof CATALOG_SORT_ORDERS)[number];
}
