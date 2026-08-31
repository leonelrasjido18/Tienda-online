import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseInterceptors, UsePipes } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { upsertLeagueSchema, type UpsertLeagueInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LeaguesService } from './leagues.service';
import { UploadsService } from '../uploads/uploads.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/leagues')
export class LeaguesController {
  constructor(
    private readonly leagues: LeaguesService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  list() {
    return this.leagues.list();
  }

  /** Sube el logo de una liga (JPG/PNG/WebP/SVG) y devuelve la URL para guardarla. */
  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return this.uploads.processAndStore(file, 'leagues');
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertLeagueSchema))
  create(@Body() body: UpsertLeagueInput) {
    return this.leagues.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertLeagueSchema))
  update(@Param('id') id: string, @Body() body: UpsertLeagueInput) {
    return this.leagues.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leagues.remove(id);
  }
}
