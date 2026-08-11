import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { FeedsService } from './feeds.service';

@Public()
@Controller('feeds')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Get('google-merchant.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async googleMerchant(@Res({ passthrough: true }) res: Response) {
    const xml = await this.feeds.googleMerchantXml();
    res.send(xml);
  }
}
