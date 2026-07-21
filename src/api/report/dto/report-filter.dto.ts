import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReportGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class ReportFilterDto {
  @ApiProperty({
    description: 'Start date (inclusive), e.g. 2026-07-01',
    example: '2026-07-01',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date (inclusive), e.g. 2026-07-31',
    example: '2026-07-31',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: 'Timeline grouping period',
    enum: ReportGroupBy,
    example: ReportGroupBy.DAY,
    required: false,
  })
  @IsEnum(ReportGroupBy)
  @IsOptional()
  groupBy?: ReportGroupBy = ReportGroupBy.DAY;
}
