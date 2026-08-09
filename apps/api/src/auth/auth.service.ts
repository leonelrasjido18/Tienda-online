import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole, StaffUserDto } from '@tienda/shared';
import bcrypt from 'bcryptjs';

import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: StaffUserDto;
}

const REFRESH_TOKEN_SEPARATOR = '.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async validateCredentials(email: string, password: string) {
    const user = await this.prisma.staffUser.findUnique({ where: { email } });

    // Mensaje genérico en ambos casos: no revelar si el email existe o no.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return user;
  }

  async login(email: string, password: string, meta: RequestMeta): Promise<IssuedTokens> {
    const user = await this.validateCredentials(email, password);

    await this.prisma.staffUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(
      { id: user.id, email: user.email, role: user.role as unknown as StaffRole, name: user.name },
      meta,
    );
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<IssuedTokens> {
    const { id, secret } = this.parseRawToken(rawRefreshToken);

    const existing = await this.prisma.refreshToken.findUnique({
      where: { id },
      include: { staffUser: true },
    });

    if (!existing) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (existing.revokedAt) {
      // El refresh token ya fue rotado antes: esto indica que se reutilizó un
      // token viejo (robo o doble uso). Se revoca toda la familia de sesiones
      // del usuario por seguridad.
      await this.prisma.refreshToken.updateMany({
        where: { staffUserId: existing.staffUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Sesión inválida, iniciá sesión de nuevo');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const providedHash = this.hashSecret(secret);
    const currentHash = Buffer.from(existing.tokenHash);
    const provided = Buffer.from(providedHash);
    if (currentHash.length !== provided.length || !timingSafeEqual(currentHash, provided)) {
      throw new UnauthorizedException('Sesión inválida');
    }

    if (!existing.staffUser.isActive) {
      throw new UnauthorizedException('Cuenta deshabilitada');
    }

    const issued = await this.issueTokens(
      {
        id: existing.staffUser.id,
        email: existing.staffUser.email,
        role: existing.staffUser.role as unknown as StaffRole,
        name: existing.staffUser.name,
      },
      meta,
    );

    const newId = this.parseRawToken(issued.refreshToken).id;

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByToken: newId },
    });

    return issued;
  }

  async logout(rawRefreshToken: string | undefined) {
    if (!rawRefreshToken) return;

    try {
      const { id } = this.parseRawToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Cookie malformada o token inexistente: el logout es idempotente.
    }
  }

  async getSafeUser(userId: string): Promise<StaffUserDto> {
    const user = await this.prisma.staffUser.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, email: user.email, name: user.name, role: user.role as unknown as StaffRole };
  }

  private async issueTokens(
    user: { id: string; email: string; role: AuthenticatedUser['role']; name: string },
    meta: RequestMeta,
  ): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);

    const id = randomUUID();
    const secret = randomBytes(48).toString('hex');
    const tokenHash = this.hashSecret(secret);

    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id,
        staffUserId: user.id,
        tokenHash,
        expiresAt,
        createdByIp: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: `${id}${REFRESH_TOKEN_SEPARATOR}${secret}`,
      refreshTokenExpiresAt: expiresAt,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private parseRawToken(rawToken: string): { id: string; secret: string } {
    const separatorIndex = rawToken.indexOf(REFRESH_TOKEN_SEPARATOR);
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Sesión inválida');
    }
    const id = rawToken.slice(0, separatorIndex);
    const secret = rawToken.slice(separatorIndex + 1);
    if (!id || !secret) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return { id, secret };
  }
}
