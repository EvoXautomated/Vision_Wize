import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Can } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

class TagDto {
  @IsString() @MinLength(1) @MaxLength(40) name: string;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
}

class UpdateTagDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsString() @MaxLength(20) color?: string;
}

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Can('clients.read')
  @Get()
  async list() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { clients: { where: { client: { deletedAt: null } } } } } },
    });
    return tags.map((t) => ({ id: t.id, name: t.name, color: t.color, clients: t._count.clients }));
  }

  @Can('settings.manage')
  @Post()
  create(@Body() dto: TagDto) {
    return this.prisma.tag.create({ data: { name: dto.name.trim(), color: dto.color } });
  }

  @Can('settings.manage')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTagDto) {
    return this.prisma.tag.update({ where: { id }, data: { name: dto.name?.trim(), color: dto.color } });
  }

  @Can('settings.manage')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.prisma.$transaction([
      this.prisma.clientTag.deleteMany({ where: { tagId: id } }),
      this.prisma.tag.delete({ where: { id } }),
    ]);
  }
}
