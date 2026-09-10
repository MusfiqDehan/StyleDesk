import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DashboardChartRange } from '../dashboard-chart.types.js';

export class DashboardChartRangeDto {
  @ApiProperty({
    enum: DashboardChartRange,
    example: DashboardChartRange.MONTH,
    description:
      'Chart time window in Asia/Dhaka: week (7 days), month (30 days), 6m (6 calendar months), year (12 months of current year)',
  })
  @IsEnum(DashboardChartRange)
  range!: DashboardChartRange;
}
