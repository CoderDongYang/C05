import { PrismaClient, RoleName, Environment } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ROLE_PERMISSIONS } from '../src/common/config/permissions.config';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const descriptions: Record<string, string> = {
      ADMIN: '系统管理员，拥有全部权限',
      DEVELOPER: '开发人员，可管理 DEV 和 STAGING 环境',
      TESTER: '测试人员，可修改白名单',
      PRODUCT_MANAGER: '产品经理，可管理 PROD 开关状态和灰度比例',
    };

    await prisma.role.upsert({
      where: { name: roleName as RoleName },
      update: {
        description: descriptions[roleName],
        permissions: permissions as unknown as never,
      },
      create: {
        name: roleName as RoleName,
        description: descriptions[roleName],
        permissions: permissions as unknown as never,
      },
    });
    console.log(`Upserted role: ${roleName}`);
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: RoleName.ADMIN },
  });
  if (!adminRole) {
    throw new Error('ADMIN role not found');
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      email: 'admin@example.com',
      passwordHash,
      roleId: adminRole.id,
    },
    create: {
      username: 'admin',
      email: 'admin@example.com',
      passwordHash,
      roleId: adminRole.id,
    },
  });
  console.log('Upserted user: admin / admin123');

  const devRole = await prisma.role.findUnique({
    where: { name: RoleName.DEVELOPER },
  });

  if (devRole) {
    await prisma.user.upsert({
      where: { username: 'developer' },
      update: {
        email: 'dev@example.com',
        passwordHash: await bcrypt.hash('dev123', 10),
        roleId: devRole.id,
      },
      create: {
        username: 'developer',
        email: 'dev@example.com',
        passwordHash: await bcrypt.hash('dev123', 10),
        roleId: devRole.id,
      },
    });
    console.log('Upserted user: developer / dev123');
  }

  const sampleToggles = [
    {
      key: 'new_homepage',
      description: '新版首页功能开关',
      env: Environment.DEV,
      enabled: true,
      percentage: 50,
      whitelist: ['user_1001', 'user_1002'],
    },
    {
      key: 'new_homepage',
      description: '新版首页功能开关',
      env: Environment.STAGING,
      enabled: true,
      percentage: 100,
      whitelist: [],
    },
    {
      key: 'new_homepage',
      description: '新版首页功能开关',
      env: Environment.PROD,
      enabled: false,
      percentage: 10,
      whitelist: [],
    },
    {
      key: 'ai_assistant',
      description: 'AI 助手功能',
      env: Environment.DEV,
      enabled: true,
      percentage: 100,
      whitelist: [],
      rules: {
        logic: 'AND',
        conditions: [
          { field: 'isVip', operator: 'eq', value: true },
          {
            logic: 'OR',
            conditions: [
              { field: 'city', operator: 'in', value: ['北京', '上海', '深圳'] },
              { field: 'level', operator: 'gte', value: 5 },
            ],
          },
        ],
      },
    },
    {
      key: 'dark_mode',
      description: '暗黑模式',
      env: Environment.DEV,
      enabled: true,
      percentage: 0,
      whitelist: ['user_admin', 'user_tester_1'],
    },
    {
      key: 'payment_v2',
      description: '新版支付系统',
      env: Environment.STAGING,
      enabled: true,
      percentage: 80,
      whitelist: [],
    },
    {
      key: 'recommendation_algorithm_v3',
      description: '推荐算法 v3 版本',
      env: Environment.PROD,
      enabled: true,
      percentage: 25,
      whitelist: [],
      rules: {
        logic: 'AND',
        conditions: [
          { field: 'platform', operator: 'eq', value: 'ios' },
          { field: 'appVersion', operator: 'gte', value: '5.2.0' },
        ],
      },
    },
  ];

  for (const toggle of sampleToggles) {
    const existing = await prisma.featureToggle.findUnique({
      where: {
        key_environment: { key: toggle.key, environment: toggle.env },
      },
    });

    if (!existing) {
      await prisma.featureToggle.create({
        data: {
          key: toggle.key,
          description: toggle.description,
          ownerId: admin.id,
          environment: toggle.env,
          isGloballyEnabled: toggle.enabled,
          rolloutPercentage: toggle.percentage,
          whitelist: toggle.whitelist as unknown as never,
          attributeRules: (toggle.rules || {}) as unknown as never,
        },
      });
      console.log(`Created toggle: ${toggle.key} (${toggle.env})`);
    } else {
      console.log(`Toggle already exists: ${toggle.key} (${toggle.env}), skipped`);
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
