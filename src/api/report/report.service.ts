import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  Order,
  OrderPaymentStatus,
} from '../order/entities/order.entity';
import { ReportFilterDto, ReportGroupBy } from './dto/report-filter.dto';

const GROUP_FORMATS: Record<ReportGroupBy, string> = {
  [ReportGroupBy.DAY]: '%Y-%m-%d',
  [ReportGroupBy.WEEK]: '%x-W%v',
  [ReportGroupBy.MONTH]: '%Y-%m',
};

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async summary(filters: ReportFilterDto) {
    const groupBy = filters.groupBy ?? ReportGroupBy.DAY;

    // Revenue counts only orders whose payment is confirmed
    const totals = await this.baseQuery(filters)
      .select('COUNT(order.id)', 'orderCount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN order.paymentStatus = :paid THEN order.total ELSE 0 END), 0)`,
        'totalRevenue',
      )
      .setParameter('paid', OrderPaymentStatus.PAID)
      .getRawOne();

    const bySource = await this.baseQuery(filters)
      .select('order.source', 'source')
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN order.paymentStatus = :paid THEN order.total ELSE 0 END), 0)`,
        'revenue',
      )
      .setParameter('paid', OrderPaymentStatus.PAID)
      .groupBy('order.source')
      .getRawMany();

    const byStatus = await this.baseQuery(filters)
      .select('order.status', 'status')
      .addSelect('COUNT(order.id)', 'orderCount')
      .groupBy('order.status')
      .getRawMany();

    const timeline = await this.baseQuery(filters)
      .select(
        `DATE_FORMAT(order.createdAt, '${GROUP_FORMATS[groupBy]}')`,
        'period',
      )
      .addSelect('COUNT(order.id)', 'orderCount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN order.paymentStatus = :paid THEN order.total ELSE 0 END), 0)`,
        'revenue',
      )
      .setParameter('paid', OrderPaymentStatus.PAID)
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return {
      filters: {
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null,
        groupBy,
      },
      totalRevenue: Number(totals.totalRevenue),
      orderCount: Number(totals.orderCount),
      bySource: bySource.map((row) => ({
        source: row.source,
        orderCount: Number(row.orderCount),
        revenue: Number(row.revenue),
      })),
      byStatus: byStatus.map((row) => ({
        status: row.status,
        orderCount: Number(row.orderCount),
      })),
      timeline: timeline.map((row) => ({
        period: row.period,
        orderCount: Number(row.orderCount),
        revenue: Number(row.revenue),
      })),
    };
  }

  async exportCsv(filters: ReportFilterDto): Promise<string> {
    const orders = await this.baseQuery(filters)
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .orderBy('order.createdAt', 'ASC')
      .getMany();

    const header = [
      'id',
      'createdAt',
      'source',
      'status',
      'paymentMethod',
      'paymentStatus',
      'customerName',
      'phone',
      'address',
      'userPhone',
      'items',
      'total',
      'note',
    ];

    const rows = orders.map((order) => {
      const items = (order.orderItems ?? [])
        .map(
          (item) =>
            `${item.product?.name ?? item.productId} x${item.quantity} @${item.unitPrice}`,
        )
        .join('; ');

      return [
        order.id,
        order.createdAt.toISOString(),
        order.source,
        order.status,
        order.paymentMethod,
        order.paymentStatus,
        order.customerName ?? order.shippingAddress?.fullName ?? '',
        order.phone ?? order.shippingAddress?.phone ?? '',
        order.address ?? order.shippingAddress?.addressLine ?? '',
        order.user?.phone ?? '',
        items,
        order.total,
        order.note ?? '',
      ];
    });

    return [header, ...rows]
      .map((row) => row.map((cell) => this.escapeCsv(cell)).join(','))
      .join('\n');
  }

  private escapeCsv(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private baseQuery(filters: ReportFilterDto): SelectQueryBuilder<Order> {
    const query = this.orderRepository.createQueryBuilder('order');

    if (filters.startDate) {
      query.andWhere('order.createdAt >= :startDate', {
        startDate: `${filters.startDate} 00:00:00`,
      });
    }

    if (filters.endDate) {
      query.andWhere('order.createdAt <= :endDate', {
        endDate: `${filters.endDate} 23:59:59`,
      });
    }

    return query;
  }
}
