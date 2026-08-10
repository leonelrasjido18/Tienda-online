import { Body, Controller, Delete, Post, Req, UsePipes } from '@nestjs/common';
import { pushSubscriptionSchema, type PushSubscriptionInput } from '@tienda/shared';
import type { Request } from 'express';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PushService } from './push.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('subscribe')
  @UsePipes(new ZodValidationPipe(pushSubscriptionSchema))
  subscribe(@Body() body: PushSubscriptionInput, @Req() req: Request) {
    return this.push.subscribe(body, req.headers['user-agent']);
  }

  @Delete('subscribe')
  unsubscribe(@Body('endpoint') endpoint: string) {
    return this.push.unsubscribe(endpoint);
  }
}
