import { Controller, Sse, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { map } from 'rxjs/operators';
import { SseService } from './sse.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/roles.decorator';
import { Permission } from '../../common/enums/role.enum';

@Controller('api/events')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Permissions(Permission.FEATURE_READ)
  sendEvents() {
    return this.sseService.subscribe().pipe(
      map((message) => ({
        data: message,
      })),
    );
  }
}
