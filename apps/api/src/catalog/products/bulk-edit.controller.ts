import { Body, Controller, Get, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { bulkEditSchema, type BulkEditInput } from '@tienda/shared';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BulkEditService } from './bulk-edit.service';

/** Edición masiva de productos: cambia muchos de una, así que es de la dueña. */
@Roles('OWNER')
@Controller('admin/bulk-edit')
export class BulkEditController {
  constructor(private readonly bulk: BulkEditService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(bulkEditSchema))
  preview(@Body() body: BulkEditInput) {
    return this.bulk.preview(body);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(bulkEditSchema))
  apply(@Body() body: BulkEditInput, @CurrentUser() user: AuthenticatedUser) {
    return this.bulk.apply(body, user?.id ?? null);
  }

  @Get('history')
  history() {
    return this.bulk.history();
  }
}
