import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportService } from './report.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '../user/entities/user-role.entity';

@ApiTags('Admin Reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRoleEnum.ADMIN)
@ApiBearerAuth('access-token')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Order summary: revenue and counts by source/status with day/week/month timeline (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  summary(@Query() filters: ReportFilterDto) {
    return this.reportService.summary(filters);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export orders as CSV (Admin only)' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async export(@Query() filters: ReportFilterDto, @Res() res: Response) {
    const csv = await this.reportService.exportCsv(filters);

    const suffix = [filters.startDate, filters.endDate]
      .filter(Boolean)
      .join('_');
    const filename = `orders${suffix ? `_${suffix}` : ''}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    // BOM so Excel opens Cyrillic text correctly
    res.send(`﻿${csv}`);
  }
}
