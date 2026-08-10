import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseInterceptors, UsePipes } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { upsertPatchSchema, type UpsertPatchInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UploadsService } from '../uploads/uploads.service';
import { PatchesService } from './patches.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/patches')
export class PatchesController {
  constructor(
    private readonly patches: PatchesService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  list() {
    return this.patches.list();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.processAndStore(file, 'patches');
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertPatchSchema))
  create(@Body() body: UpsertPatchInput) {
    return this.patches.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertPatchSchema))
  update(@Param('id') id: string, @Body() body: UpsertPatchInput) {
    return this.patches.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.patches.remove(id);
  }
}
