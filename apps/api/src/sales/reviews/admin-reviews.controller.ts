import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { REVIEW_STATUSES, type ReviewStatus } from '@tienda/shared';

import { Roles } from '../../auth/decorators/roles.decorator';
import { ReviewsService } from './reviews.service';

@Roles('OWNER', 'STAFF')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Query('status') status?: string) {
    const valid = status && (REVIEW_STATUSES as readonly string[]).includes(status) ? (status as ReviewStatus) : undefined;
    return this.reviews.listForModeration(valid);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.reviews.setStatus(id, 'APPROVED');
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.reviews.setStatus(id, 'REJECTED');
  }
}
