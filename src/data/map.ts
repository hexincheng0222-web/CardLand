// ============================================================
// CardLand Map Data — All 96 points (6 zones × 4 sub-zones × 4 directions)
// Resource reserve system + movement costs
// ============================================================

import type {
  MapPoint,
  ZoneId,
  SubZoneId,
  ItemId,
} from './types';

// ============================================================
// Resource Reserve System
// ============================================================

export interface ResourceReserve {
  pointId: string;
  itemId: ItemId;
  currentStock: number;
  maxStock: number;
  regenerationRate: number;
}

const REGENERATION_RATES: Partial<Record<ItemId, number>> = {
  '食物': 1.0,
  '水': Infinity,
  '草药': 0.5,
  '解毒草': 0.4,
  '木材': 0.3,
  '纤维': 0.5,
  '粘土': 0.2,
  '石材': 0.1,
  '铁矿': 0.15,
  '硫磺': 0.2,
  '黑曜石': 0.1,
  '高级材料': 0.05,
  '蛇胆': 0.1,
  '绳索': 0.1,
  '金属件': 0.1,
  '布料': 0.15,
  '工具': 0.02,
  '藏宝图': 0,
  '渔网': 0,
};

const MAX_STOCK_MAP: Partial<Record<ItemId, number>> = {
  '食物': 20,
  '水': 9999,
  '草药': 15,
  '解毒草': 12,
  '木材': 18,
  '纤维': 16,
  '粘土': 15,
  '石材': 14,
  '铁矿': 10,
  '硫磺': 12,
  '黑曜石': 8,
  '高级材料': 6,
  '蛇胆': 4,
  '绳索': 8,
  '金属件': 10,
  '布料': 10,
  '工具': 3,
  '藏宝图': 2,
  '渔网': 3,
};

// ============================================================
// MAP POINTS: Zone C — 山地/火山 (16 points)
// ============================================================

const ZONE_C_POINTS: MapPoint[] = [
  // C1. 山脚营地
  {
    id: 'C1-North', zone: 'C', subZone: 'C1', direction: 'north',
    name: '岩壁庇护所', type: '休息点',
    description: '靠山一侧山体凹陷形成的天然庇护',
    outputs: [], risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'C1-South', zone: 'C', subZone: 'C1', direction: 'south',
    name: '碎石坡', type: '资源点',
    description: '下山方向的碎石地带',
    outputs: [
      { itemId: '石材', min: 2, max: 5 },
      { itemId: '工具', min: 1, max: 3 },
    ],
    risks: ['火山活动预警 33%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'C1-East', zone: 'C', subZone: 'C1', direction: 'east',
    name: '山泉眼', type: '资源点',
    description: '东侧山脚下的天然泉眼',
    outputs: [
      { itemId: '水', min: 3, max: 6 },
    ],
    risks: ['泉水含硫磺 50% 饮用后不适'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'C1-West', zone: 'C', subZone: 'C1', direction: 'west',
    name: '落石区', type: '危险点',
    description: '西侧山体松动区域',
    outputs: [], risks: ['被落石砸伤风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },

  // C2. 矿洞
  {
    id: 'C2-North', zone: 'C', subZone: 'C2', direction: 'north',
    name: '深处回响', type: '危险点',
    description: '北侧洞穴深处传来奇怪声响',
    outputs: [], risks: ['塌方风险（需火把照明）'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'C2-South', zone: 'C', subZone: 'C2', direction: 'south',
    name: '支撑木架', type: '资源点',
    description: '南侧入口附近老旧的木制支撑结构',
    outputs: [
      { itemId: '木材', min: 2, max: 4 },
      { itemId: '金属件', min: 1, max: 3 },
    ],
    risks: ['塌方 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'C2-East', zone: 'C', subZone: 'C2', direction: 'east',
    name: '矿脉', type: '资源点',
    description: '东侧裸露的矿脉层',
    outputs: [
      { itemId: '铁矿', min: 2, max: 5 },
    ],
    risks: ['碎石崩落受伤'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'C2-West', zone: 'C', subZone: 'C2', direction: 'west',
    name: '水晶裂隙', type: '事件点',
    description: '西侧岩壁上的发光水晶裂缝',
    outputs: [
      { itemId: '高级材料', min: 0, max: 1 },
    ],
    risks: ['水晶裂隙抉择 50%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },

  // C3. 火山口
  {
    id: 'C3-North', zone: 'C', subZone: 'C3', direction: 'north',
    name: '熔岩管', type: '事件点',
    description: '北侧深处冷却的熔岩管道',
    outputs: [
      { itemId: '铁矿', min: 0, max: 1 },
    ],
    risks: ['高温危险 33%'],
    choiceEvents: [],
    staminaCost: 12, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'C3-South', zone: 'C', subZone: 'C3', direction: 'south',
    name: '黑曜石滩', type: '资源点',
    description: '南侧下坡方向冷却的火山岩区域',
    outputs: [
      { itemId: '黑曜石', min: 1, max: 3 },
    ],
    risks: ['踩空灼伤'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'C3-East', zone: 'C', subZone: 'C3', direction: 'east',
    name: '硫磺池', type: '资源点',
    description: '东侧火山活动形成的硫磺沉积',
    outputs: [
      { itemId: '硫磺', min: 2, max: 4 },
    ],
    risks: ['火山喷发 33%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'C3-West', zone: 'C', subZone: 'C3', direction: 'west',
    name: '热气喷口', type: '危险点',
    description: '西侧地面裂缝喷出高温气体',
    outputs: [], risks: ['灼伤风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },

  // C4. 温泉
  {
    id: 'C4-North', zone: 'C', subZone: 'C4', direction: 'north',
    name: '热泉瀑布', type: '事件点',
    description: '北侧温泉形成的热水瀑布',
    outputs: [], risks: ['隐藏洞穴入口'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'C4-South', zone: 'C', subZone: 'C4', direction: 'south',
    name: '温泉池', type: '休息点',
    description: '南侧天然温泉水池',
    outputs: [], risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'C4-East', zone: 'C', subZone: 'C4', direction: 'east',
    name: '温泉矿物质', type: '资源点',
    description: '东侧温泉边的矿物沉积',
    outputs: [
      { itemId: '硫磺', min: 0, max: 2 },
      { itemId: '高级材料', min: 1, max: 3 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'C4-West', zone: 'C', subZone: 'C4', direction: 'west',
    name: '蒸汽裂口', type: '危险点',
    description: '西侧高温蒸汽从裂缝喷出',
    outputs: [], risks: ['烫伤风险', '蒸汽裂口 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 4, enemyTier: null,
  },
];

// ============================================================
// MAP POINTS: Zone D — 红树林/沼泽 (16 points)
// ============================================================

const ZONE_D_POINTS: MapPoint[] = [
  // D1. 红树林水道
  {
    id: 'D1-North', zone: 'D', subZone: 'D1', direction: 'north',
    name: '水鸟巢穴', type: '事件点',
    description: '北侧内陆方向红树林中的鸟类栖息地',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '纤维', min: 2, max: 4 },
    ],
    risks: ['鸟巢中有蛇被咬'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'D1-South', zone: 'D', subZone: 'D1', direction: 'south',
    name: '树根渔场', type: '资源点',
    description: '南侧靠海方向红树根系间的鱼群聚集地',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
    ],
    risks: ['鳄鱼潜伏 33%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'D1-East', zone: 'D', subZone: 'D1', direction: 'east',
    name: '独木桥', type: '障碍点',
    description: '东侧简易的树根独木桥',
    outputs: [], risks: ['通过消耗额外体力/无绳索时落水'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'D1-West', zone: 'D', subZone: 'D1', direction: 'west',
    name: '深水坑', type: '危险点',
    description: '西侧看似浅水实则深坑',
    outputs: [], risks: ['溺水风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },

  // D2. 泥潭
  {
    id: 'D2-North', zone: 'D', subZone: 'D2', direction: 'north',
    name: '沼气气泡', type: '危险点',
    description: '北侧深处泥底冒出的可燃气体',
    outputs: [], risks: ['有火源时爆炸风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'D2-South', zone: 'D', subZone: 'D2', direction: 'south',
    name: '粘土层', type: '资源点',
    description: '南侧泥潭边缘暴露的粘土',
    outputs: [
      { itemId: '粘土', min: 2, max: 5 },
    ],
    risks: ['迷雾抉择 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'D2-East', zone: 'D', subZone: 'D2', direction: 'east',
    name: '泥温泉', type: '休息点',
    description: '东侧温暖的泥浆池',
    outputs: [], risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'D2-West', zone: 'D', subZone: 'D2', direction: 'west',
    name: '沉没物', type: '事件点',
    description: '西侧泥潭中半沉的物体',
    outputs: [], risks: ['沉没物下有活物 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },

  // D3. 芦苇荡
  {
    id: 'D3-North', zone: 'D', subZone: 'D3', direction: 'north',
    name: '水蛇出没点', type: '危险点',
    description: '北侧深处芦苇间的水蛇栖息地',
    outputs: [], risks: ['被蛇咬伤风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: 'Small',
  },
  {
    id: 'D3-South', zone: 'D', subZone: 'D3', direction: 'south',
    name: '芦苇丛', type: '资源点',
    description: '南侧外围大片芦苇生长区域',
    outputs: [
      { itemId: '纤维', min: 3, max: 6 },
    ],
    risks: ['水蛇群 33%'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'D3-East', zone: 'D', subZone: 'D3', direction: 'east',
    name: '旧渔网', type: '事件点',
    description: '东侧缠在芦苇上的漂流渔网',
    outputs: [
      { itemId: '渔网', min: 0, max: 1 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'D3-West', zone: 'D', subZone: 'D3', direction: 'west',
    name: '干地岛', type: '休息点',
    description: '西侧芦苇中一小块干燥高地',
    outputs: [], risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },

  // D4. 古井
  {
    id: 'D4-North', zone: 'D', subZone: 'D4', direction: 'north',
    name: '井壁坍塌', type: '危险点',
    description: '北侧年久失修的井壁结构',
    outputs: [], risks: ['塌方风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'D4-South', zone: 'D', subZone: 'D4', direction: 'south',
    name: '井口', type: '资源点',
    description: '南侧岛中央的古老水井',
    outputs: [
      { itemId: '水', min: 4, max: 7 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'D4-East', zone: 'D', subZone: 'D4', direction: 'east',
    name: '井壁符号', type: '事件点',
    description: '东侧井壁上模糊的古老符号',
    outputs: [
      { itemId: '藏宝图', min: 0, max: 1 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'D4-West', zone: 'D', subZone: 'D4', direction: 'west',
    name: '井底暗道', type: '事件点',
    description: '西侧水井底部的隐秘通道',
    outputs: [], risks: ['井底暗道 50%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },
];

// ============================================================
// MAP POINTS: Zone E — 珊瑚礁/浅海 (16 points)
// ============================================================

const ZONE_E_POINTS: MapPoint[] = [
  // E1. 珊瑚礁
  {
    id: 'E1-North', zone: 'E', subZone: 'E1', direction: 'north',
    name: '珊瑚洞穴', type: '事件点',
    description: '北侧靠岸方向珊瑚形成的天然洞穴',
    outputs: [
      { itemId: '高级材料', min: 0, max: 1 },
    ],
    risks: ['遭遇海鳗 50%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'E1-South', zone: 'E', subZone: 'E1', direction: 'south',
    name: '海葵区', type: '危险点',
    description: '南侧外海方向大量海葵聚集的区域',
    outputs: [], risks: ['被蜇伤风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'E1-East', zone: 'E', subZone: 'E1', direction: 'east',
    name: '礁石鱼群', type: '资源点',
    description: '东侧珊瑚间穿梭的鱼群',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
    ],
    risks: ['鱼群引来鲨鱼遭遇攻击'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'E1-West', zone: 'E', subZone: 'E1', direction: 'west',
    name: '珊瑚丛', type: '资源点',
    description: '西侧色彩斑斓的珊瑚礁群',
    outputs: [
      { itemId: '高级材料', min: 1, max: 3 },
    ],
    risks: ['海龟互动 33%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },

  // E2. 深海沟
  {
    id: 'E2-North', zone: 'E', subZone: 'E2', direction: 'north',
    name: '沉船残骸', type: '事件点',
    description: '北侧靠岸方向海沟中的沉船',
    outputs: [
      { itemId: '金属件', min: 2, max: 4 },
      { itemId: '工具', min: 0, max: 1 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 12, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'E2-South', zone: 'E', subZone: 'E2', direction: 'south',
    name: '暗流', type: '危险点',
    description: '南侧深海方向海沟中的强烈暗流',
    outputs: [], risks: ['被卷入深海（高伤害）'],
    choiceEvents: [],
    staminaCost: 12, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'E2-East', zone: 'E', subZone: 'E2', direction: 'east',
    name: '沟沿垂钓点', type: '资源点',
    description: '东侧海沟边缘的深水垂钓点',
    outputs: [
      { itemId: '食物', min: 1, max: 2 },
    ],
    risks: ['暗流抉择 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'E2-West', zone: 'E', subZone: 'E2', direction: 'west',
    name: '发光水母群', type: '事件点',
    description: '西侧深海发光的水母群',
    outputs: [
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['水母群突然散开暴露于捕食者视野'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: null,
  },

  // E3. 潮汐池
  {
    id: 'E3-North', zone: 'E', subZone: 'E3', direction: 'north',
    name: '涨潮预警点', type: '危险点',
    description: '北侧靠岸方向涨潮时会被淹没',
    outputs: [], risks: ['被困风险（需注意时间）'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'E3-South', zone: 'E', subZone: 'E3', direction: 'south',
    name: '螃蟹岬', type: '资源点',
    description: '南侧外海方向螃蟹聚集的岩石岬角',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
    ],
    risks: ['螃蟹岬 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'E3-East', zone: 'E', subZone: 'E3', direction: 'east',
    name: '潮池浅水区', type: '资源点',
    description: '东侧退潮后的浅水区域',
    outputs: [
      { itemId: '食物', min: 2, max: 5 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'E3-West', zone: 'E', subZone: 'E3', direction: 'west',
    name: '海胆岩', type: '资源点',
    description: '西侧长满海胆的岩石',
    outputs: [
      { itemId: '食物', min: 2, max: 5 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },

  // E4. 珍珠湾
  {
    id: 'E4-North', zone: 'E', subZone: 'E4', direction: 'north',
    name: '海底洞穴', type: '事件点',
    description: '北侧靠岸方向水下的隐秘洞穴',
    outputs: [
      { itemId: '高级材料', min: 0, max: 1 },
    ],
    risks: ['氧气不足风险 50%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'E4-South', zone: 'E', subZone: 'E4', direction: 'south',
    name: '鲨鱼出没区', type: '危险点',
    description: '南侧外海偶尔有鲨鱼出没的水域',
    outputs: [], risks: ['严重受伤风险'],
    choiceEvents: [],
    staminaCost: 12, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'E4-East', zone: 'E', subZone: 'E4', direction: 'east',
    name: '珠母贝床', type: '资源点',
    description: '东侧产珍珠的贝类聚集区',
    outputs: [
      { itemId: '高级材料', min: 1, max: 3 },
      { itemId: '食物', min: 2, max: 4 },
    ],
    risks: ['螃蟹岬 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'E4-West', zone: 'E', subZone: 'E4', direction: 'west',
    name: '白沙滩', type: '休息点',
    description: '西侧细腻的白色珊瑚沙海滩',
    outputs: [], risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
];

// ============================================================
// MAP POINTS: Zone F — 遗迹/洞穴 (16 points)
// ============================================================

const ZONE_F_POINTS: MapPoint[] = [
  // F1. 古老神庙
  {
    id: 'F1-North', zone: 'F', subZone: 'F1', direction: 'north',
    name: '祭坛', type: '事件点',
    description: '北侧深处中央的古老祭坛',
    outputs: [], risks: ['守护者对话 50%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'F1-South', zone: 'F', subZone: 'F1', direction: 'south',
    name: '神庙入口', type: '事件点',
    description: '南侧藤蔓覆盖的巨大石门',
    outputs: [
      { itemId: '藏宝图', min: 0, max: 1 },
    ],
    risks: ['石门机关启动 50%'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'F1-East', zone: 'F', subZone: 'F1', direction: 'east',
    name: '侧殿储藏室', type: '资源点',
    description: '东侧神庙侧面的封闭房间',
    outputs: [
      { itemId: '工具', min: 0, max: 1 },
      { itemId: '高级材料', min: 1, max: 3 },
    ],
    risks: ['古代陷阱触发'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'F1-West', zone: 'F', subZone: 'F1', direction: 'west',
    name: '机关地板', type: '危险点',
    description: '西侧刻有图案的石板地面',
    outputs: [], risks: ['触发陷阱（飞箭/落石）', '机关地板 67%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },

  // F2. 地下洞穴
  {
    id: 'F2-North', zone: 'F', subZone: 'F2', direction: 'north',
    name: '深渊裂口', type: '危险点',
    description: '北侧深处深不见底的裂缝',
    outputs: [], risks: ['坠落风险（极高伤害）', '深渊裂口 50%'],
    choiceEvents: [],
    staminaCost: 12, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'F2-South', zone: 'F', subZone: 'F2', direction: 'south',
    name: '钟乳石厅', type: '资源点',
    description: '南侧入口方向巨大的钟乳石洞穴',
    outputs: [
      { itemId: '高级材料', min: 1, max: 3 },
    ],
    risks: ['钟乳石断裂坠落砸伤'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'F2-East', zone: 'F', subZone: 'F2', direction: 'east',
    name: '地下河', type: '资源点',
    description: '东侧洞穴中的地下河流',
    outputs: [
      { itemId: '水', min: 3, max: 5 },
      { itemId: '食物', min: 1, max: 3 },
    ],
    risks: ['河水暴涨被冲走'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'F2-West', zone: 'F', subZone: 'F2', direction: 'west',
    name: '蝙蝠栖息地', type: '危险点',
    description: '西侧大量蝙蝠居住的洞顶',
    outputs: [], risks: ['被蝙蝠攻击/疾病传播'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 4, enemyTier: null,
  },

  // F3. 壁画厅
  {
    id: 'F3-North', zone: 'F', subZone: 'F3', direction: 'north',
    name: '塌方区', type: '危险点',
    description: '北侧深处不稳定的洞顶区域',
    outputs: [], risks: ['塌方风险'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'F3-South', zone: 'F', subZone: 'F3', direction: 'south',
    name: '壁画墙', type: '事件点',
    description: '南侧描绘古代文明的壁画',
    outputs: [], risks: ['获得地图信息/解锁新区域'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 3, enemyTier: null,
  },
  {
    id: 'F3-East', zone: 'F', subZone: 'F3', direction: 'east',
    name: '颜料矿', type: '资源点',
    description: '东侧壁画颜料的矿物来源',
    outputs: [
      { itemId: '高级材料', min: 2, max: 4 },
    ],
    risks: ['矿层有毒粉尘中毒'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 4, enemyTier: null,
  },
  {
    id: 'F3-West', zone: 'F', subZone: 'F3', direction: 'west',
    name: '解读台', type: '事件点',
    description: '西侧中央的石制解读台',
    outputs: [], risks: ['解读台 50%'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 3, enemyTier: null,
  },

  // F4. 祭坛
  {
    id: 'F4-North', zone: 'F', subZone: 'F4', direction: 'north',
    name: '隐藏密室', type: '事件点',
    description: '北侧最深处祭坛后的隐秘空间',
    outputs: [
      { itemId: '高级材料', min: 0, max: 1 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'F4-South', zone: 'F', subZone: 'F4', direction: 'south',
    name: '主祭坛', type: '事件点',
    description: '南侧遗迹最核心的区域',
    outputs: [], risks: ['终极抉择 100%'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'F4-East', zone: 'F', subZone: 'F4', direction: 'east',
    name: '祭品坑', type: '资源点',
    description: '东侧堆放祭品的深坑',
    outputs: [
      { itemId: '高级材料', min: 1, max: 3 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 8, dangerLevel: 5, enemyTier: null,
  },
  {
    id: 'F4-West', zone: 'F', subZone: 'F4', direction: 'west',
    name: '守护者雕像', type: '危险点',
    description: '西侧巨大的石制守护者雕像',
    outputs: [], risks: ['触发战斗/解谜'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 5, enemyTier: null,
  },
];

// ============================================================
// MAP POINTS: Zone A — 海滩 (16 points) — existing
// ============================================================

const ZONE_A_POINTS: MapPoint[] = [
  {
    id: 'A1-North', zone: 'A', subZone: 'A1', direction: 'north',
    name: '遮阳岩洞', type: '休息点',
    description: '沙滩边缘靠内陆的天然岩洞',
    outputs: [], risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A1-South', zone: 'A', subZone: 'A1', direction: 'south',
    name: '潮汐线', type: '资源点',
    description: '潮水退去后留下的痕迹线',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 1, max: 3 },
    ],
    risks: ['漂流物事件 50%'],
    choiceEvents: [
      {
        id: 'A1-drift', name: '漂流物事件', icon: '🌊',
        description: '海浪带来了一些漂流物...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A1-drift-1', label: '仔细搜索', icon: '🔍', requirements: [],
            outcomes: [
              { type: 'success', itemChanges: [{ itemId: '食物', quantity: 2 }, { itemId: '水', quantity: 1 }], attributeChanges: [{ attributeId: '体力值', amount: -10 }], message: '发现蟹/贝×2 + 随机物资×1，消耗额外体力-10' },
            ],
          },
          {
            id: 'A1-drift-2', label: '快速拾取', icon: '🏃', requirements: [],
            outcomes: [
              { type: 'partial', itemChanges: [{ itemId: '食物', quantity: 1 }, { itemId: '水', quantity: 1 }], message: '获得蟹/贝×1 + 随机物资×1' },
            ],
          },
          {
            id: 'A1-drift-3', label: '无视离开', icon: '🚫', requirements: [],
            outcomes: [
              { type: 'failure', message: '节省体力，无产出' },
            ],
          },
        ],
      },
    ],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A1-East', zone: 'A', subZone: 'A1', direction: 'east',
    name: '搁浅木筏', type: '资源点',
    description: '东侧海岸一艘被冲上岸的破损木筏',
    outputs: [
      { itemId: '绳索', min: 1, max: 3 },
      { itemId: '木材', min: 2, max: 4 },
    ],
    risks: ['木板下藏有海蟹 33% 夹伤'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A1-West', zone: 'A', subZone: 'A1', direction: 'west',
    name: '废弃营地', type: '事件点',
    description: '西侧被风暴摧毁的旧营地',
    outputs: [{ itemId: '工具', min: 0, max: 1 }],
    risks: ['废弃营地事件 50%'],
    choiceEvents: [
      {
        id: 'A1-camp', name: '废弃营地事件', icon: '🏚️',
        description: '发现废弃营地，似乎有野人巡逻...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A1-camp-1', label: '战斗', icon: '⚔️',
            requirements: [{ itemId: '工具', minValue: 1 }],
            outcomes: [
              { type: 'success', probability: 0.67, itemChanges: [{ itemId: '工具', quantity: 2 }, { itemId: '食物', quantity: 3 }], message: '胜利：工具×2、食物×3' },
              { type: 'failure', probability: 0.33, attributeChanges: [{ attributeId: '健康值', amount: -20 }], message: '失败：健康-20、损失随机物资×1' },
            ],
          },
          {
            id: 'A1-camp-2', label: '逃跑', icon: '🏃', requirements: [],
            outcomes: [
              { type: 'partial', attributeChanges: [{ attributeId: '体力值', amount: -15 }], message: '体力-15，安全撤离但无额外产出' },
            ],
          },
          {
            id: 'A1-camp-3', label: '躲藏', icon: '🤝', requirements: [],
            outcomes: [
              { type: 'success', probability: 0.5, message: '成功躲过，无损失' },
              { type: 'failure', probability: 0.5, attributeChanges: [{ attributeId: '健康值', amount: -10 }], message: '被发现，健康-10' },
            ],
          },
        ],
      },
    ],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },

  // A2. 礁石滩
  {
    id: 'A2-North', zone: 'A', subZone: 'A2', direction: 'north',
    name: '牡蛎岩壁', type: '资源点',
    description: '靠内陆一侧长满牡蛎的礁石壁',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
      { itemId: '水', min: 2, max: 4 },
    ],
    risks: ['牡蛎壳割伤 50% 受伤+感染风险'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A2-South', zone: 'A', subZone: 'A2', direction: 'south',
    name: '暗流裂口', type: '危险点',
    description: '靠海一侧看似平静实则暗流涌动',
    outputs: [],
    risks: ['受伤风险', '鲨鱼逼近 33%'],
    choiceEvents: [
      {
        id: 'A2-shark', name: '鲨鱼逼近', icon: '🦈',
        description: '暗流中出现鲨鱼...',
        triggerChance: 0.33,
        options: [
          {
            id: 'A2-shark-1', label: '快速游回', icon: '🏊',
            requirements: [{ attributeId: '体力值', minValue: 50 }],
            outcomes: [
              { type: 'success', attributeChanges: [{ attributeId: '体力值', amount: -20 }], message: '安全返回，体力-20' },
            ],
          },
          {
            id: 'A2-shark-2', label: '绳索固定', icon: '🪢',
            requirements: [{ itemId: '绳索', minValue: 1 }],
            outcomes: [
              { type: 'success', itemChanges: [{ itemId: '绳索', quantity: -1 }, { itemId: '食物', quantity: 2 }], message: '安全通过，绳索消耗×1，获得蟹/贝×2' },
            ],
          },
          {
            id: 'A2-shark-3', label: '强行突破', icon: '⚠️', requirements: [],
            outcomes: [
              { type: 'failure', probability: 0.5, attributeChanges: [{ attributeId: '健康值', amount: -15 }], message: '受伤，健康-15' },
              { type: 'success', probability: 0.5, itemChanges: [{ itemId: '食物', quantity: 3 }], message: '成功突破，获得蟹/贝×3' },
            ],
          },
        ],
      },
    ],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'A2-East', zone: 'A', subZone: 'A2', direction: 'east',
    name: '潮池', type: '资源点',
    description: '东侧岩石间天然形成的小水潭',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 1, max: 3 },
      { itemId: '纤维', min: 1, max: 2 },
    ],
    risks: ['池底有海鳗被咬'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A2-West', zone: 'A', subZone: 'A2', direction: 'west',
    name: '礁石缝隙', type: '资源点',
    description: '西侧退潮后礁石间的水洼',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 1, max: 3 },
    ],
    risks: ['礁石松动 50% 夹住肢体'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },

  // A3. 椰子林
  {
    id: 'A3-North', zone: 'A', subZone: 'A3', direction: 'north',
    name: '鸟巢高台', type: '事件点',
    description: '更靠内陆的树顶有大型鸟巢',
    outputs: [{ itemId: '食物', min: 1, max: 3 }],
    risks: ['鸟巢高台事件 50%'],
    choiceEvents: [
      {
        id: 'A3-bird', name: '鸟巢高台事件', icon: '🐦',
        description: '发现高台上的鸟巢，母鸟可能回巢...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A3-bird-1', label: '快速偷蛋', icon: '🥚', requirements: [],
            outcomes: [
              { type: 'success', probability: 0.5, itemChanges: [{ itemId: '食物', quantity: 2 }], message: '成功偷取鸟蛋×2' },
              { type: 'partial', probability: 0.5, itemChanges: [{ itemId: '食物', quantity: 2 }], attributeChanges: [{ attributeId: '健康值', amount: -10 }], message: '获得鸟蛋×2，但被母鸟攻击，健康-10' },
            ],
          },
          {
            id: 'A3-bird-2', label: '绳索速降', icon: '🪢',
            requirements: [{ itemId: '绳索', minValue: 1 }],
            outcomes: [
              { type: 'success', itemChanges: [{ itemId: '食物', quantity: 1 }], message: '获得鸟蛋×1，安全撤离' },
            ],
          },
          {
            id: 'A3-bird-3', label: '放弃攀爬', icon: '🚫', requirements: [],
            outcomes: [
              { type: 'failure', message: '无产出，绳索保留' },
            ],
          },
        ],
      },
    ],
    staminaCost: 8, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A3-South', zone: 'A', subZone: 'A3', direction: 'south',
    name: '落果空地', type: '资源点',
    description: '靠海滩一侧椰子自然落下的区域',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 0, max: 2 },
      { itemId: '纤维', min: 2, max: 4 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A3-East', zone: 'A', subZone: 'A3', direction: 'east',
    name: '老椰树群', type: '资源点',
    description: '东侧生长多年的高大椰子树',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
      { itemId: '水', min: 0, max: 2 },
      { itemId: '纤维', min: 1, max: 3 },
    ],
    risks: ['树顶有蜂巢被蜂群蜇伤'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A3-West', zone: 'A', subZone: 'A3', direction: 'west',
    name: '腐烂椰堆', type: '资源点',
    description: '西侧堆积发酵的椰子下埋藏货物',
    outputs: [{ itemId: '工具', min: 0, max: 1 }],
    risks: ['必触发蚊虫群攻击 50% 感染'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },

  // A4. 沉船湾
  {
    id: 'A4-North', zone: 'A', subZone: 'A4', direction: 'north',
    name: '船长室', type: '事件点',
    description: '船体靠内陆一侧的相对封闭房间',
    outputs: [
      { itemId: '藏宝图', min: 0, max: 1 },
      { itemId: '工具', min: 0, max: 1 },
    ],
    risks: ['船体探索事件 50%'],
    choiceEvents: [
      {
        id: 'A4-ship', name: '船体探索事件', icon: '🏚️',
        description: '探索船长室...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A4-ship-1', label: '深入搜索', icon: '🔍', requirements: [],
            outcomes: [
              { type: 'failure', probability: 0.33, attributeChanges: [{ attributeId: '健康值', amount: -15 }], message: '触发陷阱，健康-15' },
              { type: 'success', probability: 0.34, itemChanges: [{ itemId: '藏宝图', quantity: 1 }], message: '获得藏宝图×1' },
              { type: 'partial', probability: 0.33, itemChanges: [{ itemId: '工具', quantity: 1 }], message: '获得工具×1（指南针）' },
            ],
          },
          {
            id: 'A4-ship-2', label: '只搜货舱', icon: '📦', requirements: [],
            outcomes: [
              { type: 'success', itemChanges: [{ itemId: '金属件', quantity: 2 }, { itemId: '布料', quantity: 2 }], message: '获得金属件×2、布料×2，安全' },
            ],
          },
          {
            id: 'A4-ship-3', label: '放弃探索', icon: '🚫', requirements: [],
            outcomes: [
              { type: 'failure', message: '无产出' },
            ],
          },
        ],
      },
    ],
    staminaCost: 8, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A4-South', zone: 'A', subZone: 'A4', direction: 'south',
    name: '货舱', type: '资源点',
    description: '靠海一侧船底货舱，部分被淹',
    outputs: [
      { itemId: '金属件', min: 1, max: 3 },
      { itemId: '布料', min: 2, max: 4 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A4-East', zone: 'A', subZone: 'A4', direction: 'east',
    name: '船体残骸', type: '资源点',
    description: '东侧半沉的破损船体',
    outputs: [
      { itemId: '金属件', min: 2, max: 4 },
      { itemId: '木材', min: 3, max: 6 },
    ],
    risks: [], choiceEvents: [],
    staminaCost: 5, dangerLevel: 1, enemyTier: null,
  },
  {
    id: 'A4-West', zone: 'A', subZone: 'A4', direction: 'west',
    name: '断裂甲板', type: '危险点',
    description: '西侧外海方向腐朽的甲板',
    outputs: [], risks: ['受伤风险（需谨慎探索，可能塌陷）'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
];

// ============================================================
// MAP POINTS: Zone B — 丛林 (16 points) — existing
// ============================================================

const ZONE_B_POINTS: MapPoint[] = [
  // B1. 密林深处
  {
    id: 'B1-North', zone: 'B', subZone: 'B1', direction: 'north',
    name: '迷雾沼泽', type: '危险点',
    description: '北侧林间突然出现的雾气区域',
    outputs: [], risks: ['迷路（消耗额外体力）', '雾中传出兽吼 50%，33%惊退'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: 'Small',
  },
  {
    id: 'B1-South', zone: 'B', subZone: 'B1', direction: 'south',
    name: '藤蔓丛', type: '资源点',
    description: '南侧靠近外围的密集藤蔓垂落区域',
    outputs: [{ itemId: '纤维', min: 2, max: 4 }],
    risks: ['藤蔓缠绕 50% 被困'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'B1-East', zone: 'B', subZone: 'B1', direction: 'east',
    name: '巨木根系', type: '资源点',
    description: '东侧巨大树木暴露的根系区域',
    outputs: [
      { itemId: '木材', min: 2, max: 5 },
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['毒蛇遭遇 50%', '野猪拱土 33%'],
    choiceEvents: [
      {
        id: 'B1-snake', name: '毒蛇遭遇', icon: '🐍',
        description: '遭遇毒蛇！',
        triggerChance: 0.5,
        options: [
          {
            id: 'B1-snake-1', label: '战斗', icon: '⚔️', requirements: [],
            outcomes: [
              { type: 'success', probability: 0.67, itemChanges: [{ itemId: '蛇胆', quantity: 1 }, { itemId: '草药', quantity: 2 }], message: '胜利：蛇胆×1、草药×2' },
              { type: 'failure', probability: 0.33, statusEffects: ['中毒'], message: '失败：中毒（每回合-10，持续3回合）' },
            ],
          },
          {
            id: 'B1-snake-2', label: '绕行', icon: '🏃', requirements: [],
            outcomes: [
              { type: 'partial', attributeChanges: [{ attributeId: '体力值', amount: -10 }], message: '安全但无蛇胆产出，额外消耗体力-10' },
            ],
          },
          {
            id: 'B1-snake-3', label: '火把驱赶', icon: '🔥',
            requirements: [{ itemId: '工具', minValue: 1 }],
            outcomes: [
              { type: 'success', itemChanges: [{ itemId: '蛇胆', quantity: 1 }], message: '安全通过，火把消耗×1，获得蛇胆×1' },
            ],
          },
        ],
      },
    ],
    staminaCost: 10, dangerLevel: 3, enemyTier: 'Small',
  },
  {
    id: 'B1-West', zone: 'B', subZone: 'B1', direction: 'west',
    name: '兽径', type: '事件点',
    description: '西侧野兽踩出的小径',
    outputs: [{ itemId: '食物', min: 1, max: 2 }],
    risks: ['大型野猪狩猎 33%'],
    choiceEvents: [
      {
        id: 'B1-boar', name: '大型野猪狩猎', icon: '🐗',
        description: '发现大型野猪！',
        triggerChance: 0.33,
        options: [
          {
            id: 'B1-boar-1', label: '狩猎', icon: '🗡️',
            requirements: [{ itemId: '工具', minValue: 1 }, { attributeId: '体力值', minValue: 40 }],
            outcomes: [
              { type: 'success', probability: 0.67, itemChanges: [{ itemId: '食物', quantity: 4 }, { itemId: '布料', quantity: 2 }], message: '胜利：兽肉×4、布料×2' },
              { type: 'failure', probability: 0.33, attributeChanges: [{ attributeId: '健康值', amount: -25 }, { attributeId: '体力值', amount: -20 }], message: '失败：健康-25、体力-20' },
            ],
          },
          {
            id: 'B1-boar-2', label: '远程攻击', icon: '🏹',
            requirements: [{ itemId: '工具', minValue: 2 }],
            outcomes: [
              { type: 'success', probability: 0.5, itemChanges: [{ itemId: '食物', quantity: 3 }, { itemId: '布料', quantity: 1 }], message: '胜利：兽肉×3、布料×1' },
              { type: 'failure', probability: 0.5, attributeChanges: [{ attributeId: '健康值', amount: -15 }], message: '失败：健康-15' },
            ],
          },
          {
            id: 'B1-boar-3', label: '逃跑', icon: '🏃', requirements: [],
            outcomes: [
              { type: 'partial', attributeChanges: [{ attributeId: '体力值', amount: -10 }], message: '体力-10，安全撤离' },
            ],
          },
          {
            id: 'B1-boar-4', label: '躲藏', icon: '🌿', requirements: [],
            outcomes: [
              { type: 'success', probability: 0.67, message: '成功躲过' },
              { type: 'failure', probability: 0.33, attributeChanges: [{ attributeId: '健康值', amount: -10 }], message: '被发现，健康-10' },
            ],
          },
        ],
      },
    ],
    staminaCost: 10, dangerLevel: 3, enemyTier: 'Medium',
  },

  // B2. 猎人小径
  {
    id: 'B2-North', zone: 'B', subZone: 'B2', direction: 'north',
    name: '断崖边', type: '障碍点',
    description: '北侧深处小径在此断裂',
    outputs: [], risks: ['需要绳索卡牌通过'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'B2-South', zone: 'B', subZone: 'B2', direction: 'south',
    name: '旧陷阱', type: '事件点',
    description: '南侧外围废弃的捕猎陷阱',
    outputs: [{ itemId: '食物', min: 0, max: 1 }],
    risks: ['触发陷阱受伤 33%', '野猪踪迹追踪 50%'],
    choiceEvents: [
      {
        id: 'B2-trap', name: '野猪踪迹追踪', icon: '🐗',
        description: '发现野猪踪迹...',
        triggerChance: 0.5,
        options: [
          {
            id: 'B2-trap-1', label: '追踪', icon: '🔍', requirements: [],
            outcomes: [
              { type: 'success', probability: 0.67, itemChanges: [{ itemId: '食物', quantity: 3 }, { itemId: '布料', quantity: 1 }], message: '发现野猪巢穴：兽肉×3、布料×1' },
              { type: 'partial', probability: 0.33, itemChanges: [{ itemId: '食物', quantity: 3 }, { itemId: '布料', quantity: 1 }], attributeChanges: [{ attributeId: '健康值', amount: -15 }], message: '发现野猪巢穴，但遭遇野猪攻击，健康-15' },
            ],
          },
          {
            id: 'B2-trap-2', label: '修复陷阱', icon: '🪤',
            requirements: [{ itemId: '工具', minValue: 1 }],
            outcomes: [
              { type: 'success', message: '设置陷阱：下次经过此处自动获得兽肉×2' },
            ],
          },
          {
            id: 'B2-trap-3', label: '无视', icon: '🚫', requirements: [],
            outcomes: [
              { type: 'failure', message: '无产出' },
            ],
          },
        ],
      },
    ],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'B2-East', zone: 'B', subZone: 'B2', direction: 'east',
    name: '野兽标记', type: '资源点',
    description: '东侧树干上的爪痕和气味标记',
    outputs: [], risks: ['标记附近有兽径遭遇野兽'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: 'Small',
  },
  {
    id: 'B2-West', zone: 'B', subZone: 'B2', direction: 'west',
    name: '草药坡', type: '资源点',
    description: '西侧阳光充足的缓坡',
    outputs: [
      { itemId: '草药', min: 2, max: 4 },
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['坡上有蜂巢/毒蛇受伤'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: 'Small',
  },

  // B3. 瀑布潭
  {
    id: 'B3-North', zone: 'B', subZone: 'B3', direction: 'north',
    name: '瀑布后方', type: '事件点',
    description: '北侧瀑布后面隐藏的空间',
    outputs: [{ itemId: '草药', min: 0, max: 1 }],
    risks: ['瀑布后方探索事件 50%'],
    choiceEvents: [
      {
        id: 'B3-waterfall', name: '瀑布后方探索', icon: '🌊',
        description: '瀑布后面似乎有空间...',
        triggerChance: 0.5,
        options: [
          {
            id: 'B3-waterfall-1', label: '深入探索', icon: '🔍', requirements: [],
            outcomes: [
              { type: 'failure', probability: 0.33, attributeChanges: [{ attributeId: '健康值', amount: -15 }], message: '滑落摔伤，健康-15' },
              { type: 'success', probability: 0.67, itemChanges: [{ itemId: '草药', quantity: 2 }, { itemId: '高级材料', quantity: 1 }], message: '草药×2（稀有）+ 高级材料×1' },
            ],
          },
          {
            id: 'B3-waterfall-2', label: '水潭捕鱼', icon: '💧', requirements: [],
            outcomes: [
              { type: 'success', itemChanges: [{ itemId: '食物', quantity: 3 }, { itemId: '水', quantity: 2 }], message: '获得鱼×3、水×2，安全' },
            ],
          },
          {
            id: 'B3-waterfall-3', label: '原路返回', icon: '🚫', requirements: [],
            outcomes: [
              { type: 'failure', message: '无额外产出' },
            ],
          },
        ],
      },
    ],
    staminaCost: 10, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'B3-South', zone: 'B', subZone: 'B3', direction: 'south',
    name: '水潭边', type: '资源点',
    description: '南侧瀑布下方的清澈水潭',
    outputs: [
      { itemId: '水', min: 3, max: 5 },
      { itemId: '食物', min: 1, max: 3 },
    ],
    risks: ['潭底暗流 50%，33%被卷入'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'B3-East', zone: 'B', subZone: 'B3', direction: 'east',
    name: '苔藓岩壁', type: '资源点',
    description: '东侧瀑布旁的湿滑岩壁',
    outputs: [
      { itemId: '草药', min: 2, max: 4 },
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['岩壁湿滑滑落摔伤'],
    choiceEvents: [],
    staminaCost: 5, dangerLevel: 2, enemyTier: null,
  },
  {
    id: 'B3-West', zone: 'B', subZone: 'B3', direction: 'west',
    name: '湿滑石阶', type: '危险点',
    description: '西侧通往瀑布顶部的湿滑石头',
    outputs: [], risks: ['摔伤风险受伤'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 2, enemyTier: null,
  },

  // B4. 毒蛇谷
  {
    id: 'B4-North', zone: 'B', subZone: 'B4', direction: 'north',
    name: '蛇王洞穴', type: '事件点',
    description: '北侧深处的大型蛇穴',
    outputs: [{ itemId: '蛇胆', min: 0, max: 1 }],
    risks: ['蛇王抉择 67%'],
    choiceEvents: [
      {
        id: 'B4-snakeking', name: '蛇王抉择', icon: '🐍',
        description: '发现蛇王洞穴！',
        triggerChance: 0.67,
        options: [
          {
            id: 'B4-snakeking-1', label: '猎杀蛇王', icon: '🗡️',
            requirements: [{ itemId: '工具', minValue: 2 }, { attributeId: '体力值', minValue: 50 }],
            outcomes: [
              { type: 'success', probability: 0.5, itemChanges: [{ itemId: '蛇胆', quantity: 2 }, { itemId: '高级材料', quantity: 1 }], message: '胜利：蛇胆×2（稀有）+ 高级材料×1' },
              { type: 'failure', probability: 0.5, statusEffects: ['中毒'], message: '失败：蛇毒（每回合-15，持续3回合）' },
            ],
          },
          {
            id: 'B4-snakeking-2', label: '偷取蛇蛋', icon: '🥚', requirements: [],
            outcomes: [
              { type: 'partial', itemChanges: [{ itemId: '蛇胆', quantity: 1 }, { itemId: '草药', quantity: 2 }], attributeChanges: [{ attributeId: '体力值', amount: -20 }], message: '获得蛇胆×1、草药×2，被蛇群追击，体力-20' },
            ],
          },
          {
            id: 'B4-snakeking-3', label: '撤退', icon: '🏃', requirements: [],
            outcomes: [
              { type: 'failure', message: '安全撤离，无产出' },
            ],
          },
        ],
      },
    ],
    staminaCost: 12, dangerLevel: 4, enemyTier: 'Large',
  },
  {
    id: 'B4-South', zone: 'B', subZone: 'B4', direction: 'south',
    name: '解毒草丛', type: '资源点',
    description: '南侧外围蛇巢旁伴生的草药',
    outputs: [{ itemId: '解毒草', min: 2, max: 4 }],
    risks: ['草药旁盘踞着守护蛇 50% 遭遇战斗'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: 'Small',
  },
  {
    id: 'B4-East', zone: 'B', subZone: 'B4', direction: 'east',
    name: '蛇蜕草丛', type: '资源点',
    description: '东侧有大量蛇蜕的草丛',
    outputs: [
      { itemId: '草药', min: 1, max: 3 },
      { itemId: '蛇胆', min: 0, max: 1 },
    ],
    risks: ['采集时惊动附近毒蛇 50% 被咬'],
    choiceEvents: [],
    staminaCost: 8, dangerLevel: 3, enemyTier: 'Small',
  },
  {
    id: 'B4-West', zone: 'B', subZone: 'B4', direction: 'west',
    name: '蛇巢', type: '危险点',
    description: '西侧蛇类聚集的区域',
    outputs: [], risks: ['50% 遭遇毒蛇攻击'],
    choiceEvents: [],
    staminaCost: 10, dangerLevel: 3, enemyTier: 'Small',
  },
];

// ============================================================
// ALL MAP POINTS (96 total)
// ============================================================

export const MAP_POINTS: MapPoint[] = [
  ...ZONE_A_POINTS,
  ...ZONE_B_POINTS,
  ...ZONE_C_POINTS,
  ...ZONE_D_POINTS,
  ...ZONE_E_POINTS,
  ...ZONE_F_POINTS,
];

// ============================================================
// ZONE DANGER RATES
// ============================================================

export const ZONE_DANGER_RATES: Record<ZoneId, number> = {
  A: 0.1,
  B: 0.3,
  C: 0.4,
  D: 0.3,
  E: 0.3,
  F: 0.5,
};

// ============================================================
// MOVEMENT COSTS — zone/subzone connections
// ============================================================

export interface MovementCostEntry {
  from: string;
  to: string;
  timeMinutes: number;
  staminaCost: number;
  requirements: string[];
}

export const MOVEMENT_COSTS_TABLE: MovementCostEntry[] = [
  // Within Zone A
  { from: 'A1', to: 'A2', timeMinutes: 5, staminaCost: 5, requirements: [] },
  { from: 'A1', to: 'A3', timeMinutes: 5, staminaCost: 5, requirements: [] },
  { from: 'A1', to: 'A4', timeMinutes: 5, staminaCost: 5, requirements: [] },
  { from: 'A2', to: 'A3', timeMinutes: 5, staminaCost: 5, requirements: [] },
  { from: 'A2', to: 'A4', timeMinutes: 5, staminaCost: 5, requirements: [] },
  { from: 'A3', to: 'A4', timeMinutes: 5, staminaCost: 5, requirements: [] },

  // Within Zone B
  { from: 'B1', to: 'B2', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'B1', to: 'B3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'B1', to: 'B4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'B2', to: 'B3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'B2', to: 'B4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'B3', to: 'B4', timeMinutes: 10, staminaCost: 10, requirements: [] },

  // Within Zone C
  { from: 'C1', to: 'C2', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'C1', to: 'C3', timeMinutes: 15, staminaCost: 15, requirements: [] },
  { from: 'C1', to: 'C4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'C2', to: 'C3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'C2', to: 'C4', timeMinutes: 15, staminaCost: 15, requirements: [] },
  { from: 'C3', to: 'C4', timeMinutes: 10, staminaCost: 10, requirements: [] },

  // Within Zone D
  { from: 'D1', to: 'D2', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'D1', to: 'D3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'D1', to: 'D4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'D2', to: 'D3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'D2', to: 'D4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'D3', to: 'D4', timeMinutes: 10, staminaCost: 10, requirements: [] },

  // Within Zone E
  { from: 'E1', to: 'E2', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'E1', to: 'E3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'E1', to: 'E4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'E2', to: 'E3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'E2', to: 'E4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'E3', to: 'E4', timeMinutes: 10, staminaCost: 10, requirements: [] },

  // Within Zone F
  { from: 'F1', to: 'F2', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'F1', to: 'F3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'F1', to: 'F4', timeMinutes: 15, staminaCost: 15, requirements: [] },
  { from: 'F2', to: 'F3', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'F2', to: 'F4', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'F3', to: 'F4', timeMinutes: 10, staminaCost: 10, requirements: [] },

  // Cross-zone connections
  { from: 'A', to: 'B', timeMinutes: 20, staminaCost: 20, requirements: [] },
  { from: 'A', to: 'C', timeMinutes: 30, staminaCost: 30, requirements: ['rope'] },
  { from: 'A', to: 'E', timeMinutes: 10, staminaCost: 10, requirements: [] },
  { from: 'B', to: 'C', timeMinutes: 40, staminaCost: 40, requirements: ['climbing_tools'] },
  { from: 'B', to: 'D', timeMinutes: 25, staminaCost: 25, requirements: [] },
  { from: 'B', to: 'F', timeMinutes: 15, staminaCost: 15, requirements: ['decryption'] },
  { from: 'C', to: 'F', timeMinutes: 35, staminaCost: 35, requirements: [] },
  { from: 'D', to: 'E', timeMinutes: 20, staminaCost: 20, requirements: ['waterproof_gear'] },
  { from: 'D', to: 'F', timeMinutes: 25, staminaCost: 25, requirements: ['discover_entrance'] },
  { from: 'E', to: 'F', timeMinutes: 30, staminaCost: 30, requirements: ['diving_gear'] },
];

export const MOVEMENT_COSTS: Record<string, number> = Object.fromEntries(
  MOVEMENT_COSTS_TABLE.map((m) => [`${m.from}-${m.to}`, m.staminaCost]),
);

// ============================================================
// PURE FUNCTIONS
// ============================================================

export function getAllPoints(): MapPoint[] {
  return MAP_POINTS;
}

export function getPointsByZone(zone: string): MapPoint[] {
  return MAP_POINTS.filter((p) => p.zone === zone);
}

export function getPointById(id: string): MapPoint | undefined {
  return MAP_POINTS.find((p) => p.id === id);
}

export const getMapPointById = getPointById;

export function getMapPointsBySubZone(subZone: SubZoneId): MapPoint[] {
  return MAP_POINTS.filter((p) => p.subZone === subZone);
}

export function createReserves(): ResourceReserve[] {
  const reserves: ResourceReserve[] = [];
  for (const point of MAP_POINTS) {
    for (const output of point.outputs) {
      const maxStock = MAX_STOCK_MAP[output.itemId] ?? 10;
      const regenRate = REGENERATION_RATES[output.itemId] ?? 0.1;
      const initialRatio = 0.5 + Math.random() * 0.5;
      reserves.push({
        pointId: point.id,
        itemId: output.itemId,
        currentStock: Math.floor(maxStock * initialRatio),
        maxStock,
        regenerationRate: regenRate,
      });
    }
  }
  return reserves;
}

export function createReservesSeeded(seed: number): ResourceReserve[] {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const reserves: ResourceReserve[] = [];
  for (const point of MAP_POINTS) {
    for (const output of point.outputs) {
      const maxStock = MAX_STOCK_MAP[output.itemId] ?? 10;
      const regenRate = REGENERATION_RATES[output.itemId] ?? 0.1;
      const initialRatio = 0.5 + next() * 0.5;
      reserves.push({
        pointId: point.id,
        itemId: output.itemId,
        currentStock: Math.floor(maxStock * initialRatio),
        maxStock,
        regenerationRate: regenRate,
      });
    }
  }
  return reserves;
}

export function regenerateReserves(
  reserves: ResourceReserve[],
  hours: number,
): ResourceReserve[] {
  return reserves.map((r) => {
    if (r.regenerationRate === 0) return r;
    const newStock = Math.min(
      r.maxStock,
      r.currentStock + r.regenerationRate * hours,
    );
    return { ...r, currentStock: Math.round(newStock * 100) / 100 };
  });
}

export function depleteReserve(
  reserves: ResourceReserve[],
  pointId: string,
  itemId: string,
  quantity: number,
): ResourceReserve[] {
  return reserves.map((r) => {
    if (r.pointId !== pointId || r.itemId !== itemId) return r;
    const newStock = Math.max(0, r.currentStock - quantity);
    return { ...r, currentStock: newStock };
  });
}

export function getMovementCost(
  from: string,
  to: string,
): MovementCostEntry | undefined {
  const direct = MOVEMENT_COSTS_TABLE.find(
    (m) => (m.from === from && m.to === to) || (m.from === to && m.to === from),
  );
  if (direct) return direct;

  const fromZone = from.charAt(0);
  const toZone = to.charAt(0);
  if (fromZone !== toZone) {
    return MOVEMENT_COSTS_TABLE.find(
      (m) => (m.from === fromZone && m.to === toZone) || (m.from === toZone && m.to === fromZone),
    );
  }

  return undefined;
}

export function getConnectedPoints(pointId: string): string[] {
  const point = getPointById(pointId);
  if (!point) return [];

  const connected: string[] = [];
  const subZone = point.subZone;

  for (const p of MAP_POINTS) {
    if (p.id === pointId) continue;
    if (p.subZone === subZone) {
      connected.push(p.id);
      continue;
    }
    const cost = getMovementCost(subZone, p.subZone);
    if (cost) {
      connected.push(p.id);
    }
  }

  const zone = point.zone;
  for (const m of MOVEMENT_COSTS_TABLE) {
    if (m.from === zone || m.to === zone) {
      const otherZone = m.from === zone ? m.to : m.from;
      if (otherZone.length === 1) {
        for (const p of MAP_POINTS) {
          if (p.zone === otherZone && !connected.includes(p.id)) {
            connected.push(p.id);
          }
        }
      }
    }
  }

  return connected;
}

export function isPathLocked(from: string, to: string): boolean {
  const cost = getMovementCost(from, to);
  return cost === undefined;
}

export const ALL_SUB_ZONES: SubZoneId[] = [
  'A1', 'A2', 'A3', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4',
  'E1', 'E2', 'E3', 'E4',
  'F1', 'F2', 'F3', 'F4',
];
