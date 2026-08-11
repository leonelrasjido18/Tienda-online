import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createReviewSchema, type CreateReviewInput } from '@tienda/shared';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CustomerJwtGuard } from '../customers-auth/customer-jwt.guard';
import type { CustomerPrincipal } from '../customers-auth/customer-jwt.strategy';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Reseñas aprobadas de un producto, para la ficha pública. */
  @Public()
  @Get('catalog/products/:slug/reviews')
  getForProduct(@Param('slug') slug: string) {
    return this.reviews.getSummaryBySlug(slug);
  }

  /** Alta de reseña. La ruta es pública para el guard global, pero exige sesión de cliente. */
  @Public()
  @UseGuards(CustomerJwtGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reviews')
  @HttpCode(HttpStatus.OK)
  create(@Req() req: Request, @Body(new ZodValidationPipe(createReviewSchema)) body: CreateReviewInput) {
    const user = req.user as CustomerPrincipal;
    return this.reviews.create({ id: user.id, email: user.email }, body);
  }
}
