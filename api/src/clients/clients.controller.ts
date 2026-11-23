import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, Can, CurrentUser } from '../common/decorators.js';
import { csvRow } from '../common/csv.js';
import { shopDate } from '../common/tz.js';
import {
  CreateClientDto,
  DuplicatesQuery,
  ImportDto,
  ListClientsQuery,
  MergeDto,
  NoteDto,
  UpdateClientDto,
} from './clients.dto.js';
import { ClientsService, toClientJson } from './clients.service.js';
import { ImportService } from './import.service.js';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly importer: ImportService,
  ) {}

  @Can('clients.read')
  @Get()
  list(@Query() q: ListClientsQuery, @CurrentUser() me: AuthUser) {
    return this.clients.list(q, me);
  }

  /** Aviso al registrar: ¿ya existe alguien con ese teléfono, correo o nombre? */
  @Can('clients.read')
  @Get('duplicates')
  duplicates(@Query() q: DuplicatesQuery) {
    return this.clients.duplicates(q);
  }

  @Can('clients.export')
  @Get('export.csv')
  async export(@CurrentUser() me: AuthUser, @Res() res: Response) {
    const rows = await this.clients.exportRows(me);
    const head = csvRow([
      'Nombre', 'Apellido', 'Teléfono', 'Correo', 'Nacimiento', 'Dirección',
      'Vendedora', 'Último examen', 'Próxima revisión', 'Etiquetas',
      'Acepta SMS', 'Acepta correo', 'Baja', 'Cómo nos conoció', 'Alta',
    ]);
    const body = rows
      .map((c) =>
        csvRow([
          c.firstName, c.lastName, c.phone ? `+${c.phone}` : '', c.email, c.birthDate,
          c.address, c.seller?.fullName, c.lastExamAt, c.nextExamDue,
          c.tags.map((t) => t.name).join(', '),
          c.smsConsentAt ? 'Sí' : 'No', c.emailConsentAt ? 'Sí' : 'No',
          c.unsubscribedAt ? 'Sí' : 'No', c.source, c.createdAt.toISOString().slice(0, 10),
        ]),
      )
      .join('');
    // BOM para que Excel abra bien los acentos.
    res
      .type('text/csv; charset=utf-8')
      .attachment(`clientes-${shopDate()}.csv`)
      .send(`\uFEFF${head}${body}`);
  }

  /** Importación desde Excel: primero con dryRun para ver el informe. */
  @Can('clients.import')
  @Post('import')
  import(@Body() dto: ImportDto, @CurrentUser() me: AuthUser) {
    return this.importer.run(dto.rows, dto.dryRun ?? false, me);
  }

  @Can('clients.read')
  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return toClientJson(await this.clients.findVisible(id, me));
  }

  @Can('clients.read')
  @Get(':id/timeline')
  timeline(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.clients.timeline(id, me);
  }

  @Can('clients.write')
  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() me: AuthUser) {
    return this.clients.create(dto, me);
  }

  @Can('clients.write')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentUser() me: AuthUser) {
    return this.clients.update(id, dto, me);
  }

  @Can('clients.read')
  @Post(':id/notes')
  note(@Param('id') id: string, @Body() dto: NoteDto, @CurrentUser() me: AuthUser) {
    return this.clients.addNote(id, dto.body, me);
  }

  @Can('clients.merge')
  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() dto: MergeDto, @CurrentUser() me: AuthUser) {
    return this.clients.merge(id, dto.sourceId, me);
  }

  @Can('clients.delete')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    return this.clients.remove(id, me);
  }
}
