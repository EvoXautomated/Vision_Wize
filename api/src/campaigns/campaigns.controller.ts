import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { CampaignDto, PreviewDto, TestDto } from './campaigns.dto.js';
import { CampaignsService } from './campaigns.service.js';

@ApiTags('campaigns')
@ApiBearerAuth()
@Can('campaigns.send')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list() {
    return this.campaigns.list();
  }

  /** Cuántos clientes recibirían la campaña con este grupo y canal. */
  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewDto) {
    return this.campaigns.preview(dto.segment ?? {}, dto.channel);
  }

  @Post()
  create(@Body() dto: CampaignDto, @CurrentUser() me: AuthUser) {
    return this.campaigns.create(dto, me);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CampaignDto, @CurrentUser() me: AuthUser) {
    return this.campaigns.update(id, dto, me);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.campaigns.remove(id, me);
  }

  @Post(':id/test')
  @HttpCode(200)
  test(@Param('id') id: string, @Body() dto: TestDto, @CurrentUser() me: AuthUser) {
    return this.campaigns.test(id, dto.to, me);
  }

  @Post(':id/send')
  @HttpCode(200)
  send(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.campaigns.send(id, me);
  }
}
