import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const MAX_WIDTH = 1600;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface StoredFile {
  url: string;
}

@Injectable()
export class UploadsService {
  async processAndStore(file: Express.Multer.File | undefined, folder: string): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Formato de imagen no soportado (usá JPG, PNG o WebP)');
    }

    const targetDir = join(UPLOADS_ROOT, folder);
    await mkdir(targetDir, { recursive: true });

    const filename = `${randomUUID()}.webp`;

    await sharp(file.buffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join(targetDir, filename));

    return { url: `/uploads/${folder}/${filename}` };
  }
}
