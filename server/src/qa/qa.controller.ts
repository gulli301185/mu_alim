import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';
import { AdminGuard, AuthUser, CurrentUser } from '../common/auth';
import { ZodPipe } from '../common/zod.pipe';
import { QaService, qaBodySchema } from './qa.service';

const qaBody = { message: 'Маалымат туура эмес' };

/** Static routes (`daily`, `import/...`) are declared before the `:slug` / `:id` ones. */
@Controller('qa')
export class QaController {
  constructor(private readonly qa: QaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: Record<string, unknown>) {
    return this.qa.list(query);
  }

  @Get('daily')
  @Header('Cache-Control', 'no-store')
  daily() {
    return this.qa.daily();
  }

  @Post('import/telegram-html')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  importTelegramHtml(@Body() body: { html?: unknown } | undefined) {
    return this.qa.importTelegramHtml(body?.html);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.qa.getBySlug(slug);
  }

  @Post(':slug/view')
  @HttpCode(200)
  registerView(@Param('slug') slug: string) {
    return this.qa.registerView(slug);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(qaBodySchema, qaBody)) body: z.infer<typeof qaBodySchema>,
  ) {
    return this.qa.create(body, user.id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(qaBodySchema.partial(), qaBody)) body: Partial<z.infer<typeof qaBodySchema>>,
  ) {
    return this.qa.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.qa.remove(id);
  }
}
