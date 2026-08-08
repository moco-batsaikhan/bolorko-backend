import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ProductService } from '../product/product.service';

export interface CartTotal {
  totalItems: number;
  totalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    private readonly productService: ProductService,
  ) {}

  async getOrCreateCart(userId: number): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ['cartItems', 'cartItems.product'],
    });

    if (!cart) {
      cart = this.cartRepository.create({ userId });
      cart = await this.cartRepository.save(cart);
    }

    return cart;
  }

  async addToCart(userId: number, addToCartDto: AddToCartDto): Promise<Cart> {
    const { productId, quantity, selectedColor, selectedSize } =
      addToCartDto;

    // Verify product exists
    await this.productService.findOne(productId);

    // Stock balance is not checked when adding to cart (disabled per
    // request, matching order creation — carts/orders should go through
    // regardless of stock level)
    // if (product.stock < quantity) {
    //   throw new BadRequestException(
    //     `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`,
    //   );
    // }

    const cart = await this.getOrCreateCart(userId);

    // Check if the same product+variant already exists in cart — different
    // colors/sizes of the same product are kept as separate cart items
    let existingItem = cart.cartItems?.find(
      (item) =>
        item.productId === productId &&
        (item.selectedColor ?? null) === (selectedColor ?? null) &&
        (item.selectedSize ?? null) === (selectedSize ?? null),
    );

    if (existingItem) {
      // Update quantity (stock balance not checked — see note above)
      const newQuantity = existingItem.quantity + quantity;

      existingItem.quantity = newQuantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      // Create new cart item
      const cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
        selectedColor: selectedColor ?? null,
        selectedSize: selectedSize ?? null,
      });
      await this.cartItemRepository.save(cartItem);
    }

    return await this.getCartByUserId(userId);
  }

  async getCartByUserId(userId: number): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ['cartItems', 'cartItems.product'],
    });

    if (!cart) {
      throw new NotFoundException(`Cart not found for user ${userId}`);
    }

    return cart;
  }

  async updateCartItem(
    userId: number,
    itemId: number,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.getCartByUserId(userId);

    const cartItem = cart.cartItems?.find((item) => item.id === itemId);

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    // Stock balance is not checked when updating a cart item (disabled per
    // request, matching order creation)
    // const product = await this.productService.findOne(cartItem.productId);
    // if (product.stock < updateCartItemDto.quantity) {
    //   throw new BadRequestException(
    //     `Insufficient stock. Available: ${product.stock}, Requested: ${updateCartItemDto.quantity}`,
    //   );
    // }

    cartItem.quantity = updateCartItemDto.quantity;
    await this.cartItemRepository.save(cartItem);

    return await this.getCartByUserId(userId);
  }

  async removeFromCart(userId: number, itemId: number): Promise<Cart> {
    const cart = await this.getCartByUserId(userId);

    const cartItem = cart.cartItems?.find((item) => item.id === itemId);

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    await this.cartItemRepository.remove(cartItem);

    return await this.getCartByUserId(userId);
  }

  async clearCart(userId: number): Promise<Cart> {
    const cart = await this.getCartByUserId(userId);

    if (cart.cartItems && cart.cartItems.length > 0) {
      await this.cartItemRepository.remove(cart.cartItems);
    }

    return await this.getCartByUserId(userId);
  }

  async getCartTotal(userId: number): Promise<CartTotal> {
    const cart = await this.getCartByUserId(userId);

    const totals = (cart.cartItems ?? []).reduce(
      (acc, item) => {
        acc.totalItems += item.quantity;
        acc.totalPrice += item.quantity * Number(item.product.price);
        acc.finalPrice += item.quantity * item.product.getEffectivePrice();
        return acc;
      },
      { totalItems: 0, totalPrice: 0, finalPrice: 0 },
    );

    return {
      totalItems: totals.totalItems,
      totalPrice: totals.totalPrice,
      discountAmount: totals.totalPrice - totals.finalPrice,
      finalPrice: totals.finalPrice,
    };
  }
}
