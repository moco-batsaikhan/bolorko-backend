import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post(':userId/add')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addToCart(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() addToCartDto: AddToCartDto,
  ) {
    return this.cartService.addToCart(userId, addToCartDto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCart(@Param('userId', ParseIntPipe) userId: number) {
    return this.cartService.getCartByUserId(userId);
  }

  @Get(':userId/total')
  @ApiOperation({ summary: 'Get cart total' })
  @ApiResponse({
    status: 200,
    description: 'Cart total retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getCartTotal(@Param('userId', ParseIntPipe) userId: number) {
    return this.cartService.getCartTotal(userId);
  }

  @Patch(':userId/items/:itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item updated successfully' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateCartItem(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(userId, itemId, updateCartItemDto);
  }

  @Delete(':userId/items/:itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({
    status: 200,
    description: 'Item removed from cart successfully',
  })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  removeFromCart(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.cartService.removeFromCart(userId, itemId);
  }

  @Delete(':userId/clear')
  @ApiOperation({ summary: 'Clear cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully' })
  @ApiResponse({ status: 404, description: 'Cart not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  clearCart(@Param('userId', ParseIntPipe) userId: number) {
    return this.cartService.clearCart(userId);
  }
}
