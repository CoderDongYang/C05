import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  CreateFeatureToggleDto,
  UpdateFeatureToggleDto,
  QueryFeatureToggleDto,
} from './dto/feature-toggle.dto';
import {
  Environment,
  ChangeType,
  RoleName,
  Permission,
} from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/decorators/get-user.decorator';

const MOCK_TOGGLES = [
  {
    id: 1,
    key: 'payment.new_flow',
    description: '新支付流程',
    environment: Environment.DEV,
    isGloballyEnabled: true,
    rolloutPercentage: 100,
    whitelist: [],
    attributeRules: {},
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
    ownerId: 2,
    owner: { id: 2, username: 'dev', email: 'dev@example.com' },
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-02-01'),
  },
];

@Injectable()
export class FeatureTogglesService {
  private readonly logger = new Logger(FeatureTogglesService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

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

    const existing = await this.prisma.featureToggle.findUnique({
      where: {
        key_environment: { key: dto.key, environment: dto.environment },
      },
    });
    if (existing) {
      throw new ConflictException('该环境下已存在相同 key 的开关');
    }

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
        } as unknown as never,
        changeType: ChangeType.CREATE,
      },
    });

    await this.redisService.publishUpdate(dto.environment);
    return toggle;
  }

  async update(id: number, user: JwtPayload, dto: UpdateFeatureToggleDto) {
    const existing = await this.prisma.featureToggle.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('功能开关不存在');
    }

    const updateFields = Object.keys(dto);
    this.checkWritePermission(user, existing.environment, updateFields);

    const oldValue = {
      description: existing.description,
      ownerId: existing.ownerId,
      isGloballyEnabled: existing.isGloballyEnabled,
      rolloutPercentage: existing.rolloutPercentage,
      whitelist: existing.whitelist,
      attributeRules: existing.attributeRules,
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
        } as unknown as never,
        changeType: ChangeType.UPDATE,
      },
    });

    await this.redisService.publishUpdate(existing.environment);
    return toggle;
  }

  async remove(id: number, user: JwtPayload) {
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

    await this.redisService.publishUpdate(existing.environment);
    return { success: true };
  }
}
