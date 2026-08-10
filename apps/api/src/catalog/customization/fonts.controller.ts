import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { upsertLeagueFontSchema, type UpsertLeagueFontInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UploadsService } from '../uploads/uploads.service';
import { FontsService } from './fonts.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/fonts')
export class FontsController {
  constructor(
    private readonly fonts: FontsService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  list(@Query('leagueId') leagueId?: string) {
    return this.fonts.list(leagueId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.storeRaw(file, 'fonts');
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertLeagueFontSchema))
  create(@Body() body: UpsertLeagueFontInput) {
    return this.fonts.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertLeagueFontSchema))
  update(@Param('id') id: string, @Body() body: UpsertLeagueFontInput) {
    return this.fonts.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fonts.remove(id);
  }
}
