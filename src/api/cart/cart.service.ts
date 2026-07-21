import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ProductService } from '../product/product.service';

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
    const { productId, quantity } = addToCartDto;

    // Verify product exists and has sufficient stock
    const product = await this.productService.findOne(productId);

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`,
      );
    }

    const cart = await this.getOrCreateCart(userId);

    // Check if item already exists in cart
    let existingItem = cart.cartItems?.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      if (product.stock < newQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.stock}, Total requested: ${newQuantity}`,
        );
      }

      existingItem.quantity = newQuantity;
      await this.cartItemRepository.save(existingItem);
    } else {
      // Create new cart item
      const cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId,
        quantity,
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

    // Verify stock availability
    const product = await this.productService.findOne(cartItem.productId);

    if (product.stock < updateCartItemDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}, Requested: ${updateCartItemDto.quantity}`,
      );
    }

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

  async getCartTotal(userId: number): Promise<number> {
    const cart = await this.getCartByUserId(userId);

    return (
      cart.cartItems?.reduce((total, item) => {
        return total + item.quantity * item.product.getEffectivePrice();
      }, 0) || 0
    );
  }
}
