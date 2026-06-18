import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ChangeType, RoleName, Permission, Environment } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/decorators/get-user.decorator';

@Injectable()
export class ChangeLogsService {
  private readonly logger = new Logger(ChangeLogsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  private checkRollbackPermission(user: JwtPayload, env: Environment): void {
    if (user.roleName === RoleName.ADMIN) {
      return;
    }
    const permissions = user.permissions || [];
    if (
      !permissions.includes(Permission.ALL) &&
      !permissions.includes(Permission.CHANGELOG_ROLLBACK)
    ) {
      throw new ForbiddenException('无回滚权限');
    }
  }

  async findByToggleId(
    featureToggleId: number,
    page = 1,
    pageSize = 20,
  ) {
    const skip = (page - 1) * pageSize;
    const [logs, total] = await Promise.all([
      this.prisma.changeLog.findMany({
        where: { featureToggleId },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.changeLog.count({ where: { featureToggleId } }),
    ]);
    return { logs, total, page, pageSize };
  }

  async findAll(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [logs, total] = await Promise.all([
      this.prisma.changeLog.findMany({
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, username: true, email: true } },
          featureToggle: { select: { id: true, key: true, environment: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.changeLog.count(),
    ]);
    return { logs, total, page, pageSize };
  }

  async rollback(changeLogId: number, user: JwtPayload) {
    const changeLog = await this.prisma.changeLog.findUnique({
      where: { id: changeLogId },
    });
    if (!changeLog) {
      throw new NotFoundException('变更记录不存在');
    }

    this.checkRollbackPermission(user, changeLog.environment);

    const toggle = await this.prisma.featureToggle.findUnique({
      where: { id: changeLog.featureToggleId },
    });
    if (!toggle) {
      throw new BadRequestException('对应的功能开关已被删除，无法回滚');
    }

    if (changeLog.changeType === ChangeType.CREATE) {
      throw new BadRequestException('创建记录无法回滚，请直接删除开关');
    }

    if (changeLog.changeType === ChangeType.DELETE) {
      throw new BadRequestException('删除记录无法回滚，请重新创建开关');
    }

    const oldValue = changeLog.oldValue as Record<string, unknown>;
    if (!oldValue || Object.keys(oldValue).length === 0) {
      throw new BadRequestException('回滚数据无效');
    }

    const currentValue = {
      description: toggle.description,
      ownerId: toggle.ownerId,
      isGloballyEnabled: toggle.isGloballyEnabled,
      rolloutPercentage: toggle.rolloutPercentage,
      whitelist: toggle.whitelist,
      attributeRules: toggle.attributeRules,
    };

    const updateData: Record<string, unknown> = {};
    if (oldValue.description !== undefined) updateData.description = oldValue.description as string;
    if (oldValue.ownerId !== undefined) updateData.ownerId = oldValue.ownerId as number;
    if (oldValue.isGloballyEnabled !== undefined)
      updateData.isGloballyEnabled = oldValue.isGloballyEnabled as boolean;
    if (oldValue.rolloutPercentage !== undefined)
      updateData.rolloutPercentage = oldValue.rolloutPercentage as number;
    if (oldValue.whitelist !== undefined) updateData.whitelist = oldValue.whitelist as unknown as never;
    if (oldValue.attributeRules !== undefined) updateData.attributeRules = oldValue.attributeRules as unknown as never;

    const updatedToggle = await this.prisma.featureToggle.update({
      where: { id: toggle.id },
      data: updateData as unknown as never,
      include: {
        owner: { select: { id: true, username: true, email: true } },
      },
    });

    await this.prisma.changeLog.create({
      data: {
        featureToggleId: toggle.id,
        userId: user.userId,
        environment: toggle.environment,
        oldValue: currentValue as unknown as never,
        newValue: {
          description: updatedToggle.description,
          ownerId: updatedToggle.ownerId,
          isGloballyEnabled: updatedToggle.isGloballyEnabled,
          rolloutPercentage: updatedToggle.rolloutPercentage,
          whitelist: updatedToggle.whitelist,
          attributeRules: updatedToggle.attributeRules,
        } as unknown as never,
        changeType: ChangeType.ROLLBACK,
      },
    });

    await this.redisService.publishUpdate(toggle.environment);

    this.logger.log(
      `User ${user.username} rolled back toggle ${toggle.key} (${toggle.environment}) using changelog #${changeLogId}`,
    );

    return { success: true, toggle: updatedToggle };
  }
}
