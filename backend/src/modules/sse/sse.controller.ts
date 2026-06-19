import { Controller, Sse, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { map } from 'rxjs/operators';
import { SseService } from './sse.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Permissions } from '../../common/decorators/roles.decorator';
import { Permission } from '../../common/enums/role.enum';
import { Request } from 'express';

@Controller('api/events')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Sse()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Permissions(Permission.FEATURE_READ)
  sendEvents(@Req() req: Request) {
    const userId = (req.user as { userId?: number })?.userId;
    return this.sseService.subscribe().pipe(
      map((message) => ({
        type: message.type,
        data: {
          ...message.data,
          currentUserId: userId,
        },
      })),
    );
  }
}
