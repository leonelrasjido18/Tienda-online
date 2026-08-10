import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

const UPLOADS_ROOT = join(process.cwd(), 'uploads');
const MAX_WIDTH = 1600;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_FONT_EXTENSIONS = new Set(['.woff2', '.woff', '.ttf', '.otf']);

export interface StoredFile {
  url: string;
}

/** Convierte una URL pública ("/uploads/xxx/yyy.ext") a la ruta real en disco. */
export function resolveUploadPath(url: string): string {
  if (!url.startsWith('/uploads/')) {
    throw new Error(`URL de upload inválida: ${url}`);
  }
  return join(UPLOADS_ROOT, url.slice('/uploads/'.length));
}

@Injectable()
export class UploadsService {
  async processAndStore(file: Express.Multer.File | undefined, folder: string): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
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

  /** Guarda un buffer ya generado (ej. el PNG de producción del personalizador). */
  async storeGeneratedPng(buffer: Buffer, folder: string): Promise<StoredFile> {
    const targetDir = join(UPLOADS_ROOT, folder);
    await mkdir(targetDir, { recursive: true });

    const filename = `${randomUUID()}.png`;
    await writeFile(join(targetDir, filename), buffer);

    return { url: `/uploads/${folder}/${filename}` };
  }

  /** Guarda un archivo tal cual, sin procesarlo (usado para tipografías). */
  async storeRaw(file: Express.Multer.File | undefined, folder: string): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_FONT_EXTENSIONS.has(ext)) {
      throw new BadRequestException('Formato de tipografía no soportado (usá WOFF2, WOFF, TTF u OTF)');
    }

    const targetDir = join(UPLOADS_ROOT, folder);
    await mkdir(targetDir, { recursive: true });

    const filename = `${randomUUID()}${ext}`;
    await writeFile(join(targetDir, filename), file.buffer);

    return { url: `/uploads/${folder}/${filename}` };
  }
}
