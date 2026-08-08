import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Order,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  OrderPaymentStatus,
} from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  CreateManualOrderDto,
  ManualOrderItemDto,
} from './dto/create-manual-order.dto';
import { UpdateManualOrderDto } from './dto/update-manual-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { ProductService } from '../product/product.service';
import { PaymentService } from '../payment/payment.service';

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly productService: ProductService,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Website order: created as PENDING/UNPAID with a QPay invoice attached.
   * `userId` is null for guest checkout (login is optional for this endpoint).
   */
  async create(
    createOrderDto: CreateOrderDto,
    userId: number | null,
  ): Promise<{ order: Order; invoice: any }> {
    const orderId = await this.dataSource.transaction(async (manager) => {
      const itemsData = await this.prepareItems(createOrderDto.orderItems);
      const total = itemsData.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const orderRepo = manager.getRepository(Order);
      const order = orderRepo.create({
        userId,
        source: OrderSource.WEBSITE,
        paymentMethod: PaymentMethod.QPAY,
        paymentStatus: OrderPaymentStatus.UNPAID,
        status: OrderStatus.PENDING,
        total: total,
        phone: createOrderDto.phone,
        shippingAddress: createOrderDto.shippingAddress ?? null,
      });

      const savedOrder = await orderRepo.save(order);
      await this.saveItemsAndDecreaseStock(savedOrder.id, itemsData, manager);

      return savedOrder.id;
    });

    // Attach a QPay invoice outside the DB transaction (external HTTP call);
    // the order must survive even if QPay is down
    let invoice: any = null;
    try {
      invoice = await this.paymentService.createInvoiceForOrder(
        await this.findOne(orderId),
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to create QPay invoice for order ${orderId}: ${error.message}`,
      );
    }

    return { order: await this.findOne(orderId), invoice };
  }

  /**
   * Manual (Facebook) order entered by an admin
   */
  async createManual(dto: CreateManualOrderDto): Promise<Order> {
    const orderId = await this.dataSource.transaction(async (manager) => {
      const itemsData = await this.prepareItems(dto.items);
      const total = itemsData.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const orderRepo = manager.getRepository(Order);
      const order = orderRepo.create({
        userId: null,
        source: OrderSource.FACEBOOK,
        paymentMethod: PaymentMethod.MANUAL,
        paymentStatus: dto.paymentStatus ?? OrderPaymentStatus.UNPAID,
        status: dto.status ?? OrderStatus.PENDING,
        customerName: dto.customerName,
        phone: dto.phone,
        address: dto.address ?? null,
        note: dto.note ?? null,
        total: total,
      });

      const savedOrder = await orderRepo.save(order);
      await this.saveItemsAndDecreaseStock(savedOrder.id, itemsData, manager);

      return savedOrder.id;
    });

    return await this.findOne(orderId);
  }

  /**
   * Admin edit: customer info, note, statuses and optionally replace items.
   *
   * Stock is only held for items on a non-cancelled order, so replacing items
   * and/or flipping the CANCELLED status must agree on where stock ends up:
   * - items replaced on an order that stays cancelled: no stock touched at all
   * - items replaced while cancelling: old stock is returned, new items hold none
   * - items replaced while un-cancelling: new items reserve stock directly
   * - status flips to/from CANCELLED without an item change: restore/re-reserve
   *   stock for the existing items
   */
  async adminUpdate(id: number, dto: UpdateManualOrderDto): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const orderItemRepo = manager.getRepository(OrderItem);

      const order = await orderRepo.findOne({
        where: { id },
        relations: ['orderItems'],
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      const wasCancelled = order.status === OrderStatus.CANCELLED;
      const willBeCancelled =
        (dto.status ?? order.status) === OrderStatus.CANCELLED;

      if (dto.items) {
        if (!wasCancelled) {
          await this.restoreStock(order, manager);
        }

        await orderItemRepo.delete({ orderId: id });

        const itemsData = await this.prepareItems(dto.items);

        if (willBeCancelled) {
          await orderItemRepo.save(
            itemsData.map((item) =>
              orderItemRepo.create({ orderId: id, ...item }),
            ),
          );
        } else {
          await this.saveItemsAndDecreaseStock(id, itemsData, manager);
        }

        order.total = itemsData.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
      } else if (willBeCancelled && !wasCancelled) {
        await this.restoreStock(order, manager);
      } else if (!willBeCancelled && wasCancelled) {
        for (const orderItem of order.orderItems) {
          await this.productService.decreaseStock(
            orderItem.productId,
            orderItem.quantity,
            manager,
          );
        }
      }

      if (dto.customerName !== undefined) order.customerName = dto.customerName;
      if (dto.phone !== undefined) order.phone = dto.phone;
      if (dto.address !== undefined) order.address = dto.address;
      if (dto.note !== undefined) order.note = dto.note;
      if (dto.status !== undefined) order.status = dto.status;
      if (dto.paymentStatus !== undefined)
        order.paymentStatus = dto.paymentStatus;

      await orderRepo.save(order);

      return (await orderRepo.findOne({
        where: { id },
        relations: ['user', 'orderItems', 'orderItems.product'],
      }))!;
    });
  }

  /**
   * Admin list with source/status/date filters and pagination
   */
  async findAllPaginated(filters: FilterOrdersDto): Promise<PaginatedOrders> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.product', 'product')
      .orderBy('order.createdAt', 'DESC');

    if (filters.source) {
      query.andWhere('order.source = :source', { source: filters.source });
    }

    if (filters.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

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

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAll(): Promise<Order[]> {
    return await this.orderRepository.find({
      relations: ['user', 'orderItems', 'orderItems.product'],
    });
  }

  async findByUser(userId: number): Promise<Order[]> {
    return await this.orderRepository.find({
      where: { userId },
      relations: ['orderItems', 'orderItems.product'],
    });
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'orderItems', 'orderItems.product'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    return await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id },
        relations: ['orderItems'],
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (
        updateOrderDto.status === OrderStatus.CANCELLED &&
        order.status !== OrderStatus.CANCELLED
      ) {
        await this.restoreStock(order, manager);
      }

      Object.assign(order, updateOrderDto);

      return await orderRepo.save(order);
    });
  }

  async updateStatus(id: number, status: OrderStatus): Promise<Order> {
    return await this.update(id, { status });
  }

  async cancel(id: number): Promise<Order> {
    return await this.update(id, { status: OrderStatus.CANCELLED });
  }

  async markAsPaid(id: number): Promise<Order> {
    const order = await this.findOne(id);
    order.markAsPaid();
    return await this.orderRepository.save(order);
  }

  async remove(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({
        where: { id },
        relations: ['orderItems'],
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      if (order.status !== OrderStatus.CANCELLED) {
        await this.restoreStock(order, manager);
      }

      await orderRepo.remove(order);
    });
  }

  /**
   * Validate products/stock and resolve unit prices for order items
   */
  private async prepareItems(
    items: Array<
      | {
          productId: number;
          quantity: number;
          selectedColor?: string;
          selectedSize?: string;
        }
      | ManualOrderItemDto
    >,
  ): Promise<
    Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      selectedColor: string | null;
      selectedSize: string | null;
    }>
  > {
    const itemsData: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      selectedColor: string | null;
      selectedSize: string | null;
    }> = [];

    for (const item of items) {
      const product = await this.productService.findOne(item.productId);

      // Stock balance is not checked when placing an order (disabled per
      // request — orders should go through regardless of stock level)
      // if (product.stock < item.quantity) {
      //   throw new BadRequestException(
      //     `Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
      //   );
      // }

      const overridePrice =
        'unitPrice' in item && item.unitPrice !== undefined
          ? item.unitPrice
          : null;

      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: overridePrice ?? product.getEffectivePrice(),
        selectedColor: item.selectedColor ?? null,
        selectedSize: item.selectedSize ?? null,
      });
    }

    return itemsData;
  }

  private async saveItemsAndDecreaseStock(
    orderId: number,
    itemsData: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      selectedColor: string | null;
      selectedSize: string | null;
    }>,
    manager: EntityManager,
  ): Promise<void> {
    const orderItemRepo = manager.getRepository(OrderItem);
    const orderItems: OrderItem[] = [];

    for (const itemData of itemsData) {
      await this.productService.decreaseStock(
        itemData.productId,
        itemData.quantity,
        manager,
      );

      orderItems.push(
        orderItemRepo.create({
          orderId,
          productId: itemData.productId,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          selectedColor: itemData.selectedColor,
          selectedSize: itemData.selectedSize,
        }),
      );
    }

    await orderItemRepo.save(orderItems);
  }

  private async restoreStock(
    order: Order,
    manager: EntityManager,
  ): Promise<void> {
    for (const orderItem of order.orderItems) {
      await this.productService.increaseStock(
        orderItem.productId,
        orderItem.quantity,
        manager,
      );
    }
  }
}
