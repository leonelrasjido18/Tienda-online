import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module';
import { FontsController } from './fonts.controller';
import { FontsService } from './fonts.service';
import { PatchesController } from './patches.controller';
import { PatchesService } from './patches.service';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [UploadsModule],
  controllers: [FontsController, PatchesController, TemplatesController, RenderController],
  providers: [FontsService, PatchesService, TemplatesService, RenderService],
  exports: [FontsService, PatchesService, TemplatesService],
})
export class CustomizationModule {}
