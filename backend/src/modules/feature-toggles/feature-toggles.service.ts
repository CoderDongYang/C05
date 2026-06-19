import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService, ToggleChangeAction, ToggleChangePayload } from '../redis/redis.service';
import { RolloutUtil } from '../../common/utils/rollout.util';
import { SseService } from '../sse/sse.service';
import {
  CreateFeatureToggleDto,
  UpdateFeatureToggleDto,
  QueryFeatureToggleDto,
  DebugPreviewDto,
  ForceToggleDto,
} from './dto/feature-toggle.dto';
import {
  Environment,
  ChangeType,
  RoleName,
  Permission,
} from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/decorators/get-user.decorator';

const MOCK_USERS = [
  { id: 1, username: 'admin', password: 'admin123' },
  { id: 2, username: 'dev', password: 'dev123' },
  { id: 3, username: 'tester', password: 'test123' },
  { id: 4, username: 'pm', password: 'pm123' },
];

export interface MockToggle {
  id: number;
  key: string;
  description: string | null;
  environment: Environment;
  isGloballyEnabled: boolean;
  rolloutPercentage: number;
  whitelist: string[];
  attributeRules: Record<string, unknown>;
  dependencyKeys: string[];
  ownerId: number;
  owner: { id: number; username: string; email: string };
  createdAt: Date;
  updatedAt: Date;
}

const MOCK_TOGGLES: MockToggle[] = [
  {
    id: 1,
    key: 'payment.new_flow',
    description: '新支付流程',
    environment: Environment.DEV,
    isGloballyEnabled: true,
    rolloutPercentage: 100,
    whitelist: [],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 1,
    owner: { id: 1, username: 'admin', email: 'admin@example.com' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 2,
    key: 'user.vip_badge',
    description: 'VIP 会员徽章',
    environment: Environment.DEV,
    isGloballyEnabled: true,
    rolloutPercentage: 50,
    whitelist: ['user123', 'user456'],
    attributeRules: { level: { $gte: 5 } },
    dependencyKeys: [],
    ownerId: 2,
    owner: { id: 2, username: 'dev', email: 'dev@example.com' },
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 3,
    key: 'search.ai_suggest',
    description: 'AI 搜索建议',
    environment: Environment.DEV,
    isGloballyEnabled: false,
    rolloutPercentage: 0,
    whitelist: ['tester1'],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 2,
    owner: { id: 2, username: 'dev', email: 'dev@example.com' },
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-25'),
  },
  {
    id: 4,
    key: 'home.new_banner',
    description: '首页新 Banner',
    environment: Environment.STAGING,
    isGloballyEnabled: true,
    rolloutPercentage: 100,
    whitelist: [],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 3,
    owner: { id: 3, username: 'tester', email: 'tester@example.com' },
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: 5,
    key: 'checkout.coupon_v2',
    description: '新版优惠券系统',
    environment: Environment.STAGING,
    isGloballyEnabled: true,
    rolloutPercentage: 30,
    whitelist: ['testuser1'],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 4,
    owner: { id: 4, username: 'pm', email: 'pm@example.com' },
    createdAt: new Date('2024-01-12'),
    updatedAt: new Date('2024-01-22'),
  },
  {
    id: 6,
    key: 'profile.dark_mode',
    description: '深色模式',
    environment: Environment.PROD,
    isGloballyEnabled: true,
    rolloutPercentage: 80,
    whitelist: ['vipuser1', 'vipuser2'],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 1,
    owner: { id: 1, username: 'admin', email: 'admin@example.com' },
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-28'),
  },
  {
    id: 7,
    key: 'recommendation.ai_feed',
    description: 'AI 推荐流',
    environment: Environment.PROD,
    isGloballyEnabled: false,
    rolloutPercentage: 10,
    whitelist: ['internal_user'],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 4,
    owner: { id: 4, username: 'pm', email: 'pm@example.com' },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-30'),
  },
  {
    id: 8,
    key: 'login.social_login',
    description: '第三方登录',
    environment: Environment.PROD,
    isGloballyEnabled: true,
    rolloutPercentage: 100,
    whitelist: [],
    attributeRules: {},
    dependencyKeys: [],
    ownerId: 2,
    owner: { id: 2, username: 'dev', email: 'dev@example.com' },
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-02-01'),
  },
];

let mockAutoIncrement = MOCK_TOGGLES.length + 1;

@Injectable()
export class FeatureTogglesService {
  private readonly logger = new Logger(FeatureTogglesService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private rolloutUtil: RolloutUtil,
    private sseService: SseService,
  ) {}

  private async publishToggleChange(
    user: JwtPayload,
    toggle: { id: number; key: string; environment: Environment; isGloballyEnabled: boolean },
    action: ToggleChangeAction,
    oldEnabled?: boolean,
  ) {
    try {
      let operatorName = user.username;
      if (this.prisma.getIsConnected()) {
        const u = await this.prisma.user.findUnique({
          where: { id: user.userId },
          select: { username: true },
        });
        if (u) operatorName = u.username;
      }
      const payload: ToggleChangePayload = {
        toggleId: toggle.id,
        toggleKey: toggle.key,
        environment: toggle.environment,
        action,
        operatorId: user.userId,
        operatorName,
        oldEnabled,
        newEnabled: toggle.isGloballyEnabled,
        timestamp: new Date().toISOString(),
      };
      await this.redisService.publishUpdate(payload);
      if (!this.redisService.getClient()) {
        const now = new Date().toISOString();
        this.sseService.broadcast({
          type: 'refresh',
          data: { environment: toggle.environment },
          timestamp: now,
        });
        this.sseService.broadcast({
          type: 'toggle_change',
          data: payload as unknown as Record<string, unknown>,
          timestamp: now,
        });
      }
    } catch (e) {
      this.logger.error(`Failed to publish toggle change event: ${e}`);
    }
  }

  private async validateDependencies(
    environment: Environment,
    dependencyKeys: string[],
    enabling: boolean,
  ): Promise<void> {
    if (!enabling || !dependencyKeys || dependencyKeys.length === 0) {
      return;
    }

    const disabledDeps: string[] = [];
    for (const depKey of dependencyKeys) {
      const depToggle = await this.prisma.featureToggle.findUnique({
        where: {
          key_environment: { key: depKey, environment },
        },
        select: { key: true, isGloballyEnabled: true },
      });
      if (!depToggle || !depToggle.isGloballyEnabled) {
        disabledDeps.push(depKey);
      }
    }

    if (disabledDeps.length > 0) {
      throw new BadRequestException(
        `开启失败，请先开启依赖开关 ${disabledDeps.join('、')}`,
      );
    }
  }

  private async validatePassword(userId: number, password: string): Promise<void> {
    if (!password) {
      throw new UnauthorizedException('请输入登录密码进行二次确认');
    }

    if (!this.prisma.getIsConnected()) {
      const mockUser = MOCK_USERS.find((u) => u.id === userId);
      if (!mockUser || mockUser.password !== password) {
        throw new UnauthorizedException('密码错误');
      }
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }
  }

  private checkWritePermission(user: JwtPayload, env: Environment, fields: string[]): void {
    if (user.roleName === RoleName.ADMIN) {
      return;
    }

    const permissions = user.permissions || [];
    const hasAll = permissions.includes(Permission.ALL);

    if (env === Environment.DEV) {
      if (!hasAll && !permissions.includes(Permission.FEATURE_WRITE_DEV)) {
        throw new ForbiddenException('无 DEV 环境写入权限');
      }
    } else if (env === Environment.STAGING) {
      if (!hasAll && !permissions.includes(Permission.FEATURE_WRITE_STAGING)) {
        throw new ForbiddenException('无 STAGING 环境写入权限');
      }
    } else if (env === Environment.PROD) {
      const isDeleteOrFullWrite = fields.length === 0;
      const isOnlyWhitelist = fields.length === 1 && fields[0] === 'whitelist';
      const isStateOrPercentage =
        fields.every((f) => f === 'isGloballyEnabled' || f === 'rolloutPercentage') &&
        fields.length > 0;

      if (isDeleteOrFullWrite) {
        if (!hasAll && !permissions.includes(Permission.FEATURE_WRITE_PROD)) {
          throw new ForbiddenException('无 PROD 环境完整写入权限');
        }
      } else if (isOnlyWhitelist) {
        if (!hasAll && !permissions.includes(Permission.FEATURE_WRITE_WHITELIST)) {
          throw new ForbiddenException('无白名单修改权限');
        }
      } else if (isStateOrPercentage) {
        if (!hasAll && !permissions.includes(Permission.FEATURE_WRITE_PROD)) {
          throw new ForbiddenException('无 PROD 开关状态修改权限');
        }
      } else {
        throw new ForbiddenException('PROD 环境仅允许修改开关状态、灰度比例和白名单');
      }
    }
  }

  async findAll(query: QueryFeatureToggleDto) {
    const { environment, ownerId, key, page = 1, pageSize = 20 } = query;
    const skip = (page - 1) * pageSize;

    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock toggles data');
      let filtered = [...MOCK_TOGGLES];
      if (environment) filtered = filtered.filter((t) => t.environment === environment);
      if (ownerId) filtered = filtered.filter((t) => t.ownerId === ownerId);
      if (key) filtered = filtered.filter((t) => t.key.includes(key));
      
      filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const total = filtered.length;
      const toggles = filtered.slice(skip, skip + pageSize);
      return { toggles, total, page, pageSize };
    }

    const where: Record<string, unknown> = {};
    if (environment) where.environment = environment;
    if (ownerId) where.ownerId = ownerId;
    if (key) where.key = { contains: key };

    const [toggles, total] = await Promise.all([
      this.prisma.featureToggle.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          owner: { select: { id: true, username: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.featureToggle.count({ where }),
    ]);

    return { toggles, total, page, pageSize };
  }

  async findOne(id: number) {
    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock toggles data for findOne');
      const toggle = MOCK_TOGGLES.find((t) => t.id === id);
      if (!toggle) {
        throw new NotFoundException('功能开关不存在');
      }
      return toggle;
    }

    const toggle = await this.prisma.featureToggle.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, email: true } },
      },
    });
    if (!toggle) {
      throw new NotFoundException('功能开关不存在');
    }
    return toggle;
  }

  async create(user: JwtPayload, dto: CreateFeatureToggleDto) {
    this.checkWritePermission(user, dto.environment, Object.keys(dto));

    const dependencyKeys = dto.dependencyKeys ?? [];

    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock data for create');
      const existing = MOCK_TOGGLES.find(
        (t) => t.key === dto.key && t.environment === dto.environment,
      );
      if (existing) {
        throw new ConflictException('该环境下已存在相同 key 的开关');
      }

      if (dto.isGloballyEnabled) {
        const disabledDeps: string[] = [];
        for (const depKey of dependencyKeys) {
          const depToggle = MOCK_TOGGLES.find(
            (t) => t.key === depKey && t.environment === dto.environment,
          );
          if (!depToggle || !depToggle.isGloballyEnabled) {
            disabledDeps.push(depKey);
          }
        }
        if (disabledDeps.length > 0) {
          throw new BadRequestException(
            `开启失败，请先开启依赖开关 ${disabledDeps.join('、')}`,
          );
        }
      }

      const mockUser = MOCK_USERS.find((u) => u.id === dto.ownerId);
      const newId = mockAutoIncrement++;
      const now = new Date();
      const newToggle = {
        id: newId,
        key: dto.key,
        description: dto.description || null,
        environment: dto.environment,
        isGloballyEnabled: dto.isGloballyEnabled ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 0,
        whitelist: dto.whitelist ?? [],
        attributeRules: dto.attributeRules ?? {},
        dependencyKeys,
        ownerId: dto.ownerId,
        owner: {
          id: dto.ownerId,
          username: mockUser?.username || String(dto.ownerId),
          email: mockUser ? `${mockUser.username}@example.com` : '',
        },
        createdAt: now,
        updatedAt: now,
      };
      MOCK_TOGGLES.push(newToggle);

      await this.publishToggleChange(user, newToggle, 'create');
      return newToggle;
    }

    const existing = await this.prisma.featureToggle.findUnique({
      where: {
        key_environment: { key: dto.key, environment: dto.environment },
      },
    });
    if (existing) {
      throw new ConflictException('该环境下已存在相同 key 的开关');
    }

    await this.validateDependencies(dto.environment, dependencyKeys, dto.isGloballyEnabled ?? false);

    const toggle = await this.prisma.featureToggle.create({
      data: {
        key: dto.key,
        description: dto.description,
        ownerId: dto.ownerId,
        environment: dto.environment,
        isGloballyEnabled: dto.isGloballyEnabled ?? false,
        rolloutPercentage: dto.rolloutPercentage ?? 0,
        whitelist: (dto.whitelist ?? []) as unknown as never,
        attributeRules: (dto.attributeRules ?? {}) as unknown as never,
        dependencyKeys: dependencyKeys as unknown as never,
      },
      include: {
        owner: { select: { id: true, username: true, email: true } },
      },
    });

    await this.prisma.changeLog.create({
      data: {
        featureToggleId: toggle.id,
        userId: user.userId,
        environment: dto.environment,
        oldValue: {} as unknown as never,
        newValue: {
          key: dto.key,
          description: dto.description,
          isGloballyEnabled: dto.isGloballyEnabled ?? false,
          rolloutPercentage: dto.rolloutPercentage ?? 0,
          whitelist: dto.whitelist ?? [],
          attributeRules: dto.attributeRules ?? {},
          dependencyKeys,
        } as unknown as never,
        changeType: ChangeType.CREATE,
      },
    });

    await this.publishToggleChange(user, toggle, 'create');
    return toggle;
  }

  async update(id: number, user: JwtPayload, dto: UpdateFeatureToggleDto, skipDependencyCheck = false) {
    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock data for update');
      const idx = MOCK_TOGGLES.findIndex((t) => t.id === id);
      if (idx === -1) {
        throw new NotFoundException('功能开关不存在');
      }

      const existing = MOCK_TOGGLES[idx];
      this.checkWritePermission(user, existing.environment, Object.keys(dto));

      const existingDependencyKeys = (existing.dependencyKeys as string[]) || [];
      const newDependencyKeys = dto.dependencyKeys !== undefined ? dto.dependencyKeys : existingDependencyKeys;
      const isTurningOn = dto.isGloballyEnabled === true && existing.isGloballyEnabled === false;

      if (!skipDependencyCheck && isTurningOn) {
        const disabledDeps: string[] = [];
        for (const depKey of newDependencyKeys) {
          const depToggle = MOCK_TOGGLES.find(
            (t) => t.key === depKey && t.environment === existing.environment,
          );
          if (!depToggle || !depToggle.isGloballyEnabled) {
            disabledDeps.push(depKey);
          }
        }
        if (disabledDeps.length > 0) {
          throw new BadRequestException(
            `开启失败，请先开启依赖开关 ${disabledDeps.join('、')}`,
          );
        }
      }

      MOCK_TOGGLES[idx] = {
        ...existing,
        description: dto.description !== undefined ? dto.description : existing.description,
        ownerId: dto.ownerId !== undefined ? dto.ownerId : existing.ownerId,
        isGloballyEnabled: dto.isGloballyEnabled !== undefined ? dto.isGloballyEnabled : existing.isGloballyEnabled,
        rolloutPercentage: dto.rolloutPercentage !== undefined ? dto.rolloutPercentage : existing.rolloutPercentage,
        whitelist: dto.whitelist !== undefined ? dto.whitelist : existing.whitelist,
        attributeRules: dto.attributeRules !== undefined ? dto.attributeRules : existing.attributeRules,
        dependencyKeys: newDependencyKeys,
        updatedAt: new Date(),
      };

      const updated = MOCK_TOGGLES[idx];
      if (dto.ownerId !== undefined) {
        const mockUser = MOCK_USERS.find((u) => u.id === dto.ownerId);
        updated.owner = {
          id: dto.ownerId,
          username: mockUser?.username || String(dto.ownerId),
          email: mockUser ? `${mockUser.username}@example.com` : '',
        };
      }

      let action: ToggleChangeAction = 'update';
      if (dto.isGloballyEnabled !== undefined && dto.isGloballyEnabled !== existing.isGloballyEnabled) {
        action = dto.isGloballyEnabled ? 'enable' : 'disable';
      }
      await this.publishToggleChange(user, updated, action, existing.isGloballyEnabled);
      return updated;
    }

    const existing = await this.prisma.featureToggle.findUnique({
      where: { id },
      select: {
        id: true,
        key: true,
        environment: true,
        isGloballyEnabled: true,
        dependencyKeys: true,
        description: true,
        ownerId: true,
        rolloutPercentage: true,
        whitelist: true,
        attributeRules: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('功能开关不存在');
    }

    const updateFields = Object.keys(dto);
    this.checkWritePermission(user, existing.environment, updateFields);

    const existingDependencyKeys = (existing.dependencyKeys as string[]) || [];
    const newDependencyKeys = dto.dependencyKeys !== undefined ? dto.dependencyKeys : existingDependencyKeys;
    const willEnable =
      dto.isGloballyEnabled !== undefined
        ? dto.isGloballyEnabled
        : existing.isGloballyEnabled;

    const isTurningOn = dto.isGloballyEnabled === true && existing.isGloballyEnabled === false;
    if (!skipDependencyCheck && isTurningOn) {
      await this.validateDependencies(existing.environment, newDependencyKeys, willEnable);
    }

    const oldValue = {
      description: existing.description,
      ownerId: existing.ownerId,
      isGloballyEnabled: existing.isGloballyEnabled,
      rolloutPercentage: existing.rolloutPercentage,
      whitelist: existing.whitelist,
      attributeRules: existing.attributeRules,
      dependencyKeys: existingDependencyKeys,
    };

    const toggle = await this.prisma.featureToggle.update({
      where: { id },
      data: {
        description: dto.description,
        ownerId: dto.ownerId,
        isGloballyEnabled: dto.isGloballyEnabled,
        rolloutPercentage: dto.rolloutPercentage,
        whitelist: (dto.whitelist ?? []) as unknown as never,
        attributeRules: (dto.attributeRules ?? {}) as unknown as never,
        dependencyKeys: newDependencyKeys as unknown as never,
      },
      include: {
        owner: { select: { id: true, username: true, email: true } },
      },
    });

    await this.prisma.changeLog.create({
      data: {
        featureToggleId: toggle.id,
        userId: user.userId,
        environment: existing.environment,
        oldValue: oldValue as unknown as never,
        newValue: {
          description: toggle.description,
          ownerId: toggle.ownerId,
          isGloballyEnabled: toggle.isGloballyEnabled,
          rolloutPercentage: toggle.rolloutPercentage,
          whitelist: toggle.whitelist,
          attributeRules: toggle.attributeRules,
          dependencyKeys: newDependencyKeys,
        } as unknown as never,
        changeType: ChangeType.UPDATE,
      },
    });

    let action: ToggleChangeAction = 'update';
    if (dto.isGloballyEnabled !== undefined && dto.isGloballyEnabled !== existing.isGloballyEnabled) {
      action = dto.isGloballyEnabled ? 'enable' : 'disable';
    }
    await this.publishToggleChange(user, toggle, action, existing.isGloballyEnabled);
    return toggle;
  }

  async forceToggle(id: number, user: JwtPayload, dto: ForceToggleDto) {
    await this.validatePassword(user.userId, dto.password);
    const updateDto: UpdateFeatureToggleDto = {
      isGloballyEnabled: dto.isGloballyEnabled,
    };
    return this.update(id, user, updateDto, true);
  }

  async remove(id: number, user: JwtPayload) {
    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock data for remove');
      const idx = MOCK_TOGGLES.findIndex((t) => t.id === id);
      if (idx === -1) {
        throw new NotFoundException('功能开关不存在');
      }

      const existing = MOCK_TOGGLES[idx];
      this.checkWritePermission(user, existing.environment, []);

      MOCK_TOGGLES.splice(idx, 1);

      await this.publishToggleChange(
        user,
        {
          id: existing.id,
          key: existing.key,
          environment: existing.environment,
          isGloballyEnabled: existing.isGloballyEnabled,
        },
        'delete',
        existing.isGloballyEnabled,
      );
      return { success: true };
    }

    const existing = await this.prisma.featureToggle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('功能开关不存在');
    }

    this.checkWritePermission(user, existing.environment, []);

    const oldValue = {
      key: existing.key,
      description: existing.description,
      isGloballyEnabled: existing.isGloballyEnabled,
      rolloutPercentage: existing.rolloutPercentage,
      whitelist: existing.whitelist,
      attributeRules: existing.attributeRules,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.changeLog.create({
        data: {
          featureToggleId: id,
          userId: user.userId,
          environment: existing.environment,
          oldValue: oldValue as unknown as never,
          newValue: {} as unknown as never,
          changeType: ChangeType.DELETE,
        },
      });

      await tx.featureToggle.delete({ where: { id } });
    });

    await this.publishToggleChange(
      user,
      {
        id: existing.id,
        key: existing.key,
        environment: existing.environment,
        isGloballyEnabled: existing.isGloballyEnabled,
      },
      'delete',
      existing.isGloballyEnabled,
    );
    return { success: true };
  }

  async debugPreview(dto: DebugPreviewDto) {
    const { environment, userId, tags } = dto;

    let toggles: Array<{
      id: number;
      key: string;
      description: string | null;
      isGloballyEnabled: boolean;
      rolloutPercentage: number;
      whitelist: string[];
      attributeRules: Record<string, unknown>;
    }>;

    if (!this.prisma.getIsConnected()) {
      this.logger.warn('DB not connected, using mock toggles for debug preview');
      toggles = MOCK_TOGGLES
        .filter((t) => t.environment === environment)
        .map((t) => ({
          id: t.id,
          key: t.key,
          description: t.description,
          isGloballyEnabled: t.isGloballyEnabled,
          rolloutPercentage: t.rolloutPercentage,
          whitelist: t.whitelist as string[],
          attributeRules: t.attributeRules as Record<string, unknown>,
        }));
    } else {
      const rawToggles = await this.prisma.featureToggle.findMany({
        where: { environment },
        select: {
          id: true,
          key: true,
          description: true,
          isGloballyEnabled: true,
          rolloutPercentage: true,
          whitelist: true,
          attributeRules: true,
        },
      });
      toggles = rawToggles.map((t) => ({
        id: t.id,
        key: t.key,
        description: t.description,
        isGloballyEnabled: t.isGloballyEnabled,
        rolloutPercentage: t.rolloutPercentage,
        whitelist: (t.whitelist as string[]) || [],
        attributeRules: (t.attributeRules as Record<string, unknown>) || {},
      }));
    }

    const items = toggles.map((t) => {
      const reasons: string[] = [];

      if (!t.isGloballyEnabled) {
        return {
          toggleId: t.id,
          toggleKey: t.key,
          isMatched: false,
          matchReason: '全量开关关闭',
        };
      }

      reasons.push('全量开关开启');

      const inWhitelist = this.rolloutUtil.isInWhitelist(userId, t.whitelist as string[]);
      if (inWhitelist) {
        reasons.push(`用户 ${userId || ''} 在白名单中`);
        return {
          toggleId: t.id,
          toggleKey: t.key,
          isMatched: true,
          matchReason: reasons.join('; '),
        };
      }

      const hasRules =
        t.attributeRules && Object.keys(t.attributeRules).length > 0;
      if (hasRules) {
        const rulesMatch = this.rolloutUtil.evaluateAttributeRules(
          t.attributeRules as never,
          tags,
        );
        if (!rulesMatch) {
          reasons.push('属性规则不匹配');
          return {
            toggleId: t.id,
            toggleKey: t.key,
            isMatched: false,
            matchReason: reasons.join('; '),
          };
        }
        reasons.push('属性规则匹配');
      }

      if (t.rolloutPercentage >= 100) {
        return {
          toggleId: t.id,
          toggleKey: t.key,
          isMatched: true,
          matchReason: reasons.join('; '),
        };
      }

      const percentageHit = this.rolloutUtil.checkPercentage(userId, t.rolloutPercentage);
      if (percentageHit) {
        reasons.push(`灰度比例 ${t.rolloutPercentage}% 命中`);
        return {
          toggleId: t.id,
          toggleKey: t.key,
          isMatched: true,
          matchReason: reasons.join('; '),
        };
      }

      reasons.push(`灰度比例 ${t.rolloutPercentage}% 未命中`);
      return {
        toggleId: t.id,
        toggleKey: t.key,
        isMatched: false,
        matchReason: reasons.join('; '),
      };
    });

    return { items };
  }
}
