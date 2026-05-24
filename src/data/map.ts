// ============================================================
// CardLand V1 Map Data
// All 32 map points for zones A (Beach) and B (Jungle)
// Includes movement costs, danger rates, and zone connections
// ============================================================

import type {
  MapPoint,
  ZoneId,
  SubZoneId,
} from './types';

// ============================================================
// SECTION 1: MAP POINTS (32 total: Zone A 16 + Zone B 16)
// ============================================================

export const MAP_POINTS: MapPoint[] = [
  // ========== ZONE A: 海滩 (Beach) ==========
  // A1. 沙滩（出生点）
  {
    id: 'A1-North',
    zone: 'A',
    subZone: 'A1',
    direction: 'north',
    name: '遮阳岩洞',
    type: '休息点',
    description: '沙滩边缘靠内陆的天然岩洞',
    outputs: [],
    risks: [],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A1-South',
    zone: 'A',
    subZone: 'A1',
    direction: 'south',
    name: '潮汐线',
    type: '资源点',
    description: '潮水退去后留下的痕迹线',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 1, max: 3 },
    ],
    risks: ['⚔️ 漂流物事件 50%'],
    choiceEvents: [
      {
        id: 'A1-drift',
        name: '漂流物事件',
        icon: '🌊',
        description: '海浪带来了一些漂流物...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A1-drift-1',
            label: '仔细搜索',
            icon: '🔍',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                itemChanges: [
                  { itemId: '食物', quantity: 2 },
                  { itemId: '水', quantity: 1 },
                ],
                attributeChanges: [{ attributeId: '体力值', amount: -10 }],
                message: '发现蟹/贝×2 + 随机物资×1，消耗额外体力-10',
              },
            ],
          },
          {
            id: 'A1-drift-2',
            label: '快速拾取',
            icon: '🏃',
            requirements: [],
            outcomes: [
              {
                type: 'partial',
                itemChanges: [
                  { itemId: '食物', quantity: 1 },
                  { itemId: '水', quantity: 1 },
                ],
                message: '获得蟹/贝×1 + 随机物资×1',
              },
            ],
          },
          {
            id: 'A1-drift-3',
            label: '无视离开',
            icon: '🚫',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                message: '节省体力，无产出',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A1-East',
    zone: 'A',
    subZone: 'A1',
    direction: 'east',
    name: '搁浅木筏',
    type: '资源点',
    description: '东侧海岸一艘被冲上岸的破损木筏',
    outputs: [
      { itemId: '绳索', min: 1, max: 3 },
      { itemId: '木材', min: 2, max: 4 },
    ],
    risks: ['木板下藏有海蟹 33% 夹伤'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A1-West',
    zone: 'A',
    subZone: 'A1',
    direction: 'west',
    name: '废弃营地',
    type: '事件点',
    description: '西侧被风暴摧毁的旧营地',
    outputs: [{ itemId: '工具', min: 0, max: 1 }],
    risks: ['⚔️ 废弃营地事件 50%'],
    choiceEvents: [
      {
        id: 'A1-camp',
        name: '废弃营地事件',
        icon: '🏚️',
        description: '发现废弃营地，似乎有野人巡逻...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A1-camp-1',
            label: '战斗',
            icon: '⚔️',
            requirements: [{ itemId: '工具', minValue: 1 }],
            outcomes: [
              {
                type: 'success',
                probability: 0.67,
                itemChanges: [
                  { itemId: '工具', quantity: 2 },
                  { itemId: '食物', quantity: 3 },
                ],
                message: '胜利：工具×2、食物×3',
              },
              {
                type: 'failure',
                probability: 0.33,
                attributeChanges: [{ attributeId: '健康值', amount: -20 }],
                message: '失败：健康-20、损失随机物资×1',
              },
            ],
          },
          {
            id: 'A1-camp-2',
            label: '逃跑',
            icon: '🏃',
            requirements: [],
            outcomes: [
              {
                type: 'partial',
                attributeChanges: [{ attributeId: '体力值', amount: -15 }],
                message: '体力-15，安全撤离但无额外产出',
              },
            ],
          },
          {
            id: 'A1-camp-3',
            label: '躲藏',
            icon: '🤝',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                probability: 0.5,
                message: '成功躲过，无损失',
              },
              {
                type: 'failure',
                probability: 0.5,
                attributeChanges: [{ attributeId: '健康值', amount: -10 }],
                message: '被发现，健康-10',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },

  // A2. 礁石滩
  {
    id: 'A2-North',
    zone: 'A',
    subZone: 'A2',
    direction: 'north',
    name: '牡蛎岩壁',
    type: '资源点',
    description: '靠内陆一侧长满牡蛎的礁石壁',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
      { itemId: '水', min: 2, max: 4 },
    ],
    risks: ['牡蛎壳割伤 50% 受伤+感染风险'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A2-South',
    zone: 'A',
    subZone: 'A2',
    direction: 'south',
    name: '暗流裂口',
    type: '危险点',
    description: '靠海一侧看似平静实则暗流涌动',
    outputs: [],
    risks: ['受伤风险', '⚔️ 鲨鱼逼近 33%'],
    choiceEvents: [
      {
        id: 'A2-shark',
        name: '鲨鱼逼近',
        icon: '🦈',
        description: '暗流中出现鲨鱼...',
        triggerChance: 0.33,
        options: [
          {
            id: 'A2-shark-1',
            label: '快速游回',
            icon: '🏊',
            requirements: [{ attributeId: '体力值', minValue: 50 }],
            outcomes: [
              {
                type: 'success',
                attributeChanges: [{ attributeId: '体力值', amount: -20 }],
                message: '安全返回，体力-20',
              },
            ],
          },
          {
            id: 'A2-shark-2',
            label: '绳索固定',
            icon: '🪢',
            requirements: [{ itemId: '绳索', minValue: 1 }],
            outcomes: [
              {
                type: 'success',
                itemChanges: [
                  { itemId: '绳索', quantity: -1 },
                  { itemId: '食物', quantity: 2 },
                ],
                message: '安全通过，绳索消耗×1，获得蟹/贝×2',
              },
            ],
          },
          {
            id: 'A2-shark-3',
            label: '强行突破',
            icon: '⚠️',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                probability: 0.5,
                attributeChanges: [{ attributeId: '健康值', amount: -15 }],
                message: '受伤，健康-15',
              },
              {
                type: 'success',
                probability: 0.5,
                itemChanges: [{ itemId: '食物', quantity: 3 }],
                message: '成功突破，获得蟹/贝×3',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'A2-East',
    zone: 'A',
    subZone: 'A2',
    direction: 'east',
    name: '潮池',
    type: '资源点',
    description: '东侧岩石间天然形成的小水潭',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 1, max: 3 },
      { itemId: '纤维', min: 1, max: 2 },
    ],
    risks: ['池底有海鳗被咬'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A2-West',
    zone: 'A',
    subZone: 'A2',
    direction: 'west',
    name: '礁石缝隙',
    type: '资源点',
    description: '西侧退潮后礁石间的水洼',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 1, max: 3 },
    ],
    risks: ['礁石松动 d6,4+ 夹住肢体'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },

  // A3. 椰子林
  {
    id: 'A3-North',
    zone: 'A',
    subZone: 'A3',
    direction: 'north',
    name: '鸟巢高台',
    type: '事件点',
    description: '更靠内陆的树顶有大型鸟巢',
    outputs: [{ itemId: '食物', min: 1, max: 3 }],
    risks: ['⚔️ 鸟巢高台事件 50%'],
    choiceEvents: [
      {
        id: 'A3-bird',
        name: '鸟巢高台事件',
        icon: '🐦',
        description: '发现高台上的鸟巢，母鸟可能回巢...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A3-bird-1',
            label: '快速偷蛋',
            icon: '🥚',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                probability: 0.5,
                itemChanges: [{ itemId: '食物', quantity: 2 }],
                message: '成功偷取鸟蛋×2',
              },
              {
                type: 'partial',
                probability: 0.5,
                itemChanges: [{ itemId: '食物', quantity: 2 }],
                attributeChanges: [{ attributeId: '健康值', amount: -10 }],
                message: '获得鸟蛋×2，但被母鸟攻击，健康-10',
              },
            ],
          },
          {
            id: 'A3-bird-2',
            label: '绳索速降',
            icon: '🪢',
            requirements: [{ itemId: '绳索', minValue: 1 }],
            outcomes: [
              {
                type: 'success',
                itemChanges: [{ itemId: '食物', quantity: 1 }],
                message: '获得鸟蛋×1，安全撤离',
              },
            ],
          },
          {
            id: 'A3-bird-3',
            label: '放弃攀爬',
            icon: '🚫',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                message: '无产出，绳索保留',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 8,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A3-South',
    zone: 'A',
    subZone: 'A3',
    direction: 'south',
    name: '落果空地',
    type: '资源点',
    description: '靠海滩一侧椰子自然落下的区域',
    outputs: [
      { itemId: '食物', min: 1, max: 3 },
      { itemId: '水', min: 0, max: 2 },
      { itemId: '纤维', min: 2, max: 4 },
    ],
    risks: [],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A3-East',
    zone: 'A',
    subZone: 'A3',
    direction: 'east',
    name: '老椰树群',
    type: '资源点',
    description: '东侧生长多年的高大椰子树',
    outputs: [
      { itemId: '食物', min: 2, max: 4 },
      { itemId: '水', min: 0, max: 2 },
      { itemId: '纤维', min: 1, max: 3 },
    ],
    risks: ['树顶有蜂巢被蜂群蜇伤'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A3-West',
    zone: 'A',
    subZone: 'A3',
    direction: 'west',
    name: '腐烂椰堆',
    type: '资源点',
    description: '西侧堆积发酵的椰子下埋藏货物',
    outputs: [{ itemId: '工具', min: 0, max: 1 }],
    risks: ['必触发蚊虫群攻击 50% 感染'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: null,
  },

  // A4. 沉船湾
  {
    id: 'A4-North',
    zone: 'A',
    subZone: 'A4',
    direction: 'north',
    name: '船长室',
    type: '事件点',
    description: '船体靠内陆一侧的相对封闭房间',
    outputs: [
      { itemId: '藏宝图', min: 0, max: 1 },
      { itemId: '工具', min: 0, max: 1 },
    ],
    risks: ['⚔️ 船体探索事件 50%'],
    choiceEvents: [
      {
        id: 'A4-ship',
        name: '船体探索事件',
        icon: '🏚️',
        description: '探索船长室...',
        triggerChance: 0.5,
        options: [
          {
            id: 'A4-ship-1',
            label: '深入搜索',
            icon: '🔍',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                probability: 0.33,
                attributeChanges: [{ attributeId: '健康值', amount: -15 }],
                message: '触发陷阱，健康-15',
              },
              {
                type: 'success',
                probability: 0.34,
                itemChanges: [{ itemId: '藏宝图', quantity: 1 }],
                message: '获得藏宝图×1',
              },
              {
                type: 'partial',
                probability: 0.33,
                itemChanges: [{ itemId: '工具', quantity: 1 }],
                message: '获得工具×1（指南针）',
              },
            ],
          },
          {
            id: 'A4-ship-2',
            label: '只搜货舱',
            icon: '📦',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                itemChanges: [
                  { itemId: '金属件', quantity: 2 },
                  { itemId: '布料', quantity: 2 },
                ],
                message: '获得金属件×2、布料×2，安全',
              },
            ],
          },
          {
            id: 'A4-ship-3',
            label: '放弃探索',
            icon: '🚫',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                message: '无产出',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 8,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A4-South',
    zone: 'A',
    subZone: 'A4',
    direction: 'south',
    name: '货舱',
    type: '资源点',
    description: '靠海一侧船底货舱，部分被淹',
    outputs: [
      { itemId: '金属件', min: 1, max: 3 },
      { itemId: '布料', min: 2, max: 4 },
    ],
    risks: [],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A4-East',
    zone: 'A',
    subZone: 'A4',
    direction: 'east',
    name: '船体残骸',
    type: '资源点',
    description: '东侧半沉的破损船体',
    outputs: [
      { itemId: '金属件', min: 2, max: 4 },
      { itemId: '木材', min: 3, max: 6 },
    ],
    risks: [],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 1,
    enemyTier: null,
  },
  {
    id: 'A4-West',
    zone: 'A',
    subZone: 'A4',
    direction: 'west',
    name: '断裂甲板',
    type: '危险点',
    description: '西侧外海方向腐朽的甲板',
    outputs: [],
    risks: ['受伤风险（需谨慎探索，可能塌陷）'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: null,
  },

  // ========== ZONE B: 丛林 (Jungle) ==========
  // B1. 密林深处
  {
    id: 'B1-North',
    zone: 'B',
    subZone: 'B1',
    direction: 'north',
    name: '迷雾沼泽',
    type: '危险点',
    description: '北侧林间突然出现的雾气区域',
    outputs: [],
    risks: ['迷路（消耗额外体力）', '雾中传出兽吼 50%，33%惊退'],
    choiceEvents: [],
    staminaCost: 10,
    dangerLevel: 3,
    enemyTier: 'Small',
  },
  {
    id: 'B1-South',
    zone: 'B',
    subZone: 'B1',
    direction: 'south',
    name: '藤蔓丛',
    type: '资源点',
    description: '南侧靠近外围的密集藤蔓垂落区域',
    outputs: [{ itemId: '纤维', min: 2, max: 4 }],
    risks: ['藤蔓缠绕 50% 被困'],
    choiceEvents: [],
    staminaCost: 8,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'B1-East',
    zone: 'B',
    subZone: 'B1',
    direction: 'east',
    name: '巨木根系',
    type: '资源点',
    description: '东侧巨大树木暴露的根系区域',
    outputs: [
      { itemId: '木材', min: 2, max: 5 },
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['⚔️ 毒蛇遭遇 50%', '⚔️ 野猪拱土 33%'],
    choiceEvents: [
      {
        id: 'B1-snake',
        name: '毒蛇遭遇',
        icon: '🐍',
        description: '遭遇毒蛇！',
        triggerChance: 0.5,
        options: [
          {
            id: 'B1-snake-1',
            label: '战斗',
            icon: '⚔️',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                probability: 0.67,
                itemChanges: [
                  { itemId: '蛇胆', quantity: 1 },
                  { itemId: '草药', quantity: 2 },
                ],
                message: '胜利：蛇胆×1、草药×2',
              },
              {
                type: 'failure',
                probability: 0.33,
                statusEffects: ['中毒'],
                message: '失败：中毒（每回合-10，持续3回合）',
              },
            ],
          },
          {
            id: 'B1-snake-2',
            label: '绕行',
            icon: '🏃',
            requirements: [],
            outcomes: [
              {
                type: 'partial',
                attributeChanges: [{ attributeId: '体力值', amount: -10 }],
                message: '安全但无蛇胆产出，额外消耗体力-10',
              },
            ],
          },
          {
            id: 'B1-snake-3',
            label: '火把驱赶',
            icon: '🔥',
            requirements: [{ itemId: '工具', minValue: 1 }],
            outcomes: [
              {
                type: 'success',
                itemChanges: [{ itemId: '蛇胆', quantity: 1 }],
                message: '安全通过，火把消耗×1，获得蛇胆×1',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 10,
    dangerLevel: 3,
    enemyTier: 'Small',
  },
  {
    id: 'B1-West',
    zone: 'B',
    subZone: 'B1',
    direction: 'west',
    name: '兽径',
    type: '事件点',
    description: '西侧野兽踩出的小径',
    outputs: [{ itemId: '食物', min: 1, max: 2 }],
    risks: ['⚔️ 大型野猪狩猎 33%'],
    choiceEvents: [
      {
        id: 'B1-boar',
        name: '大型野猪狩猎',
        icon: '🐗',
        description: '发现大型野猪！',
        triggerChance: 0.33,
        options: [
          {
            id: 'B1-boar-1',
            label: '狩猎',
            icon: '🗡️',
            requirements: [
              { itemId: '工具', minValue: 1 },
              { attributeId: '体力值', minValue: 40 },
            ],
            outcomes: [
              {
                type: 'success',
                probability: 0.67,
                itemChanges: [
                  { itemId: '食物', quantity: 4 },
                  { itemId: '布料', quantity: 2 },
                ],
                message: '胜利：兽肉×4、布料×2',
              },
              {
                type: 'failure',
                probability: 0.33,
                attributeChanges: [
                  { attributeId: '健康值', amount: -25 },
                  { attributeId: '体力值', amount: -20 },
                ],
                message: '失败：健康-25、体力-20',
              },
            ],
          },
          {
            id: 'B1-boar-2',
            label: '远程攻击',
            icon: '🏹',
            requirements: [{ itemId: '工具', minValue: 2 }],
            outcomes: [
              {
                type: 'success',
                probability: 0.5,
                itemChanges: [
                  { itemId: '食物', quantity: 3 },
                  { itemId: '布料', quantity: 1 },
                ],
                message: '胜利：兽肉×3、布料×1',
              },
              {
                type: 'failure',
                probability: 0.5,
                attributeChanges: [{ attributeId: '健康值', amount: -15 }],
                message: '失败：健康-15',
              },
            ],
          },
          {
            id: 'B1-boar-3',
            label: '逃跑',
            icon: '🏃',
            requirements: [],
            outcomes: [
              {
                type: 'partial',
                attributeChanges: [{ attributeId: '体力值', amount: -10 }],
                message: '体力-10，安全撤离',
              },
            ],
          },
          {
            id: 'B1-boar-4',
            label: '躲藏',
            icon: '🌿',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                probability: 0.67,
                message: '成功躲过',
              },
              {
                type: 'failure',
                probability: 0.33,
                attributeChanges: [{ attributeId: '健康值', amount: -10 }],
                message: '被发现，健康-10',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 10,
    dangerLevel: 3,
    enemyTier: 'Medium',
  },

  // B2. 猎人小径
  {
    id: 'B2-North',
    zone: 'B',
    subZone: 'B2',
    direction: 'north',
    name: '断崖边',
    type: '障碍点',
    description: '北侧深处小径在此断裂',
    outputs: [],
    risks: ['需要绳索卡牌通过'],
    choiceEvents: [],
    staminaCost: 8,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'B2-South',
    zone: 'B',
    subZone: 'B2',
    direction: 'south',
    name: '旧陷阱',
    type: '事件点',
    description: '南侧外围废弃的捕猎陷阱',
    outputs: [{ itemId: '食物', min: 0, max: 1 }],
    risks: ['触发陷阱受伤 33%', '⚔️ 野猪踪迹追踪 50%'],
    choiceEvents: [
      {
        id: 'B2-trap',
        name: '野猪踪迹追踪',
        icon: '🐗',
        description: '发现野猪踪迹...',
        triggerChance: 0.5,
        options: [
          {
            id: 'B2-trap-1',
            label: '追踪',
            icon: '🔍',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                probability: 0.67,
                itemChanges: [
                  { itemId: '食物', quantity: 3 },
                  { itemId: '布料', quantity: 1 },
                ],
                message: '发现野猪巢穴：兽肉×3、布料×1',
              },
              {
                type: 'partial',
                probability: 0.33,
                itemChanges: [
                  { itemId: '食物', quantity: 3 },
                  { itemId: '布料', quantity: 1 },
                ],
                attributeChanges: [{ attributeId: '健康值', amount: -15 }],
                message: '发现野猪巢穴，但遭遇野猪攻击，健康-15',
              },
            ],
          },
          {
            id: 'B2-trap-2',
            label: '修复陷阱',
            icon: '🪤',
            requirements: [{ itemId: '工具', minValue: 1 }],
            outcomes: [
              {
                type: 'success',
                message: '设置陷阱：下次经过此处自动获得兽肉×2',
              },
            ],
          },
          {
            id: 'B2-trap-3',
            label: '无视',
            icon: '🚫',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                message: '无产出',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 8,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'B2-East',
    zone: 'B',
    subZone: 'B2',
    direction: 'east',
    name: '野兽标记',
    type: '资源点',
    description: '东侧树干上的爪痕和气味标记',
    outputs: [],
    risks: ['标记附近有兽径遭遇野兽'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: 'Small',
  },
  {
    id: 'B2-West',
    zone: 'B',
    subZone: 'B2',
    direction: 'west',
    name: '草药坡',
    type: '资源点',
    description: '西侧阳光充足的缓坡',
    outputs: [
      { itemId: '草药', min: 2, max: 4 },
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['坡上有蜂巢/毒蛇受伤'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: 'Small',
  },

  // B3. 瀑布潭
  {
    id: 'B3-North',
    zone: 'B',
    subZone: 'B3',
    direction: 'north',
    name: '瀑布后方',
    type: '事件点',
    description: '北侧瀑布后面隐藏的空间',
    outputs: [{ itemId: '草药', min: 0, max: 1 }],
    risks: ['⚔️ 瀑布后方探索事件 50%'],
    choiceEvents: [
      {
        id: 'B3-waterfall',
        name: '瀑布后方探索',
        icon: '🌊',
        description: '瀑布后面似乎有空间...',
        triggerChance: 0.5,
        options: [
          {
            id: 'B3-waterfall-1',
            label: '深入探索',
            icon: '🔍',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                probability: 0.33,
                attributeChanges: [{ attributeId: '健康值', amount: -15 }],
                message: '滑落摔伤，健康-15',
              },
              {
                type: 'success',
                probability: 0.67,
                itemChanges: [
                  { itemId: '草药', quantity: 2 },
                  { itemId: '高级材料', quantity: 1 },
                ],
                message: '草药×2（稀有）+ 高级材料×1',
              },
            ],
          },
          {
            id: 'B3-waterfall-2',
            label: '水潭捕鱼',
            icon: '💧',
            requirements: [],
            outcomes: [
              {
                type: 'success',
                itemChanges: [
                  { itemId: '食物', quantity: 3 },
                  { itemId: '水', quantity: 2 },
                ],
                message: '获得鱼×3、水×2，安全',
              },
            ],
          },
          {
            id: 'B3-waterfall-3',
            label: '原路返回',
            icon: '🚫',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                message: '无额外产出',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 10,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'B3-South',
    zone: 'B',
    subZone: 'B3',
    direction: 'south',
    name: '水潭边',
    type: '资源点',
    description: '南侧瀑布下方的清澈水潭',
    outputs: [
      { itemId: '水', min: 3, max: 5 },
      { itemId: '食物', min: 1, max: 3 },
    ],
    risks: ['潭底暗流 50%，33%被卷入'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'B3-East',
    zone: 'B',
    subZone: 'B3',
    direction: 'east',
    name: '苔藓岩壁',
    type: '资源点',
    description: '东侧瀑布旁的湿滑岩壁',
    outputs: [
      { itemId: '草药', min: 2, max: 4 },
      { itemId: '草药', min: 1, max: 3 },
    ],
    risks: ['岩壁湿滑滑落摔伤'],
    choiceEvents: [],
    staminaCost: 5,
    dangerLevel: 2,
    enemyTier: null,
  },
  {
    id: 'B3-West',
    zone: 'B',
    subZone: 'B3',
    direction: 'west',
    name: '湿滑石阶',
    type: '危险点',
    description: '西侧通往瀑布顶部的湿滑石头',
    outputs: [],
    risks: ['摔伤风险受伤'],
    choiceEvents: [],
    staminaCost: 8,
    dangerLevel: 2,
    enemyTier: null,
  },

  // B4. 毒蛇谷
  {
    id: 'B4-North',
    zone: 'B',
    subZone: 'B4',
    direction: 'north',
    name: '蛇王洞穴',
    type: '事件点',
    description: '北侧深处的大型蛇穴',
    outputs: [{ itemId: '蛇胆', min: 0, max: 1 }],
    risks: ['⚔️ 蛇王抉择 67%'],
    choiceEvents: [
      {
        id: 'B4-snakeking',
        name: '蛇王抉择',
        icon: '🐍',
        description: '发现蛇王洞穴！',
        triggerChance: 0.67,
        options: [
          {
            id: 'B4-snakeking-1',
            label: '猎杀蛇王',
            icon: '🗡️',
            requirements: [
              { itemId: '工具', minValue: 2 },
              { attributeId: '体力值', minValue: 50 },
            ],
            outcomes: [
              {
                type: 'success',
                probability: 0.5,
                itemChanges: [
                  { itemId: '蛇胆', quantity: 2 },
                  { itemId: '高级材料', quantity: 1 },
                ],
                message: '胜利：蛇胆×2（稀有）+ 高级材料×1',
              },
              {
                type: 'failure',
                probability: 0.5,
                statusEffects: ['中毒'],
                message: '失败：蛇毒（每回合-15，持续3回合）',
              },
            ],
          },
          {
            id: 'B4-snakeking-2',
            label: '偷取蛇蛋',
            icon: '🥚',
            requirements: [],
            outcomes: [
              {
                type: 'partial',
                itemChanges: [
                  { itemId: '蛇胆', quantity: 1 },
                  { itemId: '草药', quantity: 2 },
                ],
                attributeChanges: [{ attributeId: '体力值', amount: -20 }],
                message: '获得蛇胆×1、草药×2，被蛇群追击，体力-20',
              },
            ],
          },
          {
            id: 'B4-snakeking-3',
            label: '撤退',
            icon: '🏃',
            requirements: [],
            outcomes: [
              {
                type: 'failure',
                message: '安全撤离，无产出',
              },
            ],
          },
        ],
      },
    ],
    staminaCost: 12,
    dangerLevel: 4,
    enemyTier: 'Large',
  },
  {
    id: 'B4-South',
    zone: 'B',
    subZone: 'B4',
    direction: 'south',
    name: '解毒草丛',
    type: '资源点',
    description: '南侧外围蛇巢旁伴生的草药',
    outputs: [{ itemId: '解毒草', min: 2, max: 4 }],
    risks: ['草药旁盘踞着守护蛇 50% 遭遇战斗'],
    choiceEvents: [],
    staminaCost: 8,
    dangerLevel: 3,
    enemyTier: 'Small',
  },
  {
    id: 'B4-East',
    zone: 'B',
    subZone: 'B4',
    direction: 'east',
    name: '蛇蜕草丛',
    type: '资源点',
    description: '东侧有大量蛇蜕的草丛',
    outputs: [
      { itemId: '草药', min: 1, max: 3 },
      { itemId: '蛇胆', min: 0, max: 1 },
    ],
    risks: ['采集时惊动附近毒蛇 50% 被咬'],
    choiceEvents: [],
    staminaCost: 8,
    dangerLevel: 3,
    enemyTier: 'Small',
  },
  {
    id: 'B4-West',
    zone: 'B',
    subZone: 'B4',
    direction: 'west',
    name: '蛇巢',
    type: '危险点',
    description: '西侧蛇类聚集的区域',
    outputs: [],
    risks: ['50% 遭遇毒蛇攻击'],
    choiceEvents: [],
    staminaCost: 10,
    dangerLevel: 3,
    enemyTier: 'Small',
  },
] as const;

// ============================================================
// SECTION 2: MOVEMENT COSTS
// ============================================================

export const MOVEMENT_COSTS: Record<string, number> = {
  // Within Zone A
  'A1-A2': 5,
  'A1-A3': 5,
  'A1-A4': 5,
  'A2-A3': 5,
  'A2-A4': 5,
  'A3-A4': 5,
  // Zone A to Zone B
  'A-B1': 20,
  'A-B2': 20,
  'A-B3': 20,
  'A-B4': 20,
  // Within Zone B
  'B1-B2': 10,
  'B1-B3': 10,
  'B1-B4': 10,
  'B2-B3': 10,
  'B2-B4': 10,
  'B3-B4': 10,
} as const;

// ============================================================
// SECTION 3: ZONE CONNECTIONS (including locked paths for v1)
// ============================================================

export interface ZoneConnection {
  from: string;
  to: string;
  staminaCost: number;
  locked: boolean;
  requirement?: string;
}

export const ZONE_CONNECTIONS: ZoneConnection[] = [
  // V1 unlocked paths
  { from: 'A', to: 'B', staminaCost: 20, locked: false },
  { from: 'A', to: 'E', staminaCost: 10, locked: true, requirement: 'v2解锁' },
  // V2+ locked paths
  { from: 'A', to: 'C', staminaCost: 30, locked: true, requirement: '需绳索' },
  { from: 'B', to: 'C', staminaCost: 40, locked: true, requirement: '需登山工具' },
  { from: 'B', to: 'D', staminaCost: 25, locked: true, requirement: 'v2解锁' },
  { from: 'B', to: 'F', staminaCost: 15, locked: true, requirement: '需解密' },
  { from: 'C', to: 'F', staminaCost: 35, locked: true, requirement: '唯一通道' },
  { from: 'D', to: 'E', staminaCost: 20, locked: true, requirement: '需防水装备' },
  { from: 'D', to: 'F', staminaCost: 25, locked: true, requirement: '需发现入口' },
  { from: 'E', to: 'F', staminaCost: 30, locked: true, requirement: '需潜水装备' },
] as const;

// ============================================================
// SECTION 4: ZONE DANGER RATES
// ============================================================

export const ZONE_DANGER_RATES: Record<ZoneId, number> = {
  A: 0.1, // 10% - 海滩相对安全
  B: 0.3, // 30% - 丛林危险
} as const;

// ============================================================
// SECTION 5: MAP LOOKUP HELPERS
// ============================================================

export function getMapPointById(id: string): MapPoint | undefined {
  return MAP_POINTS.find((p) => p.id === id);
}

export function getMapPointsByZone(zone: ZoneId): MapPoint[] {
  return MAP_POINTS.filter((p) => p.zone === zone);
}

export function getMapPointsBySubZone(subZone: SubZoneId): MapPoint[] {
  return MAP_POINTS.filter((p) => p.subZone === subZone);
}

export function getMovementCost(from: string, to: string): number | undefined {
  const key1 = `${from}-${to}`;
  const key2 = `${to}-${from}`;
  return MOVEMENT_COSTS[key1] ?? MOVEMENT_COSTS[key2];
}

export function isPathLocked(from: string, to: string): boolean {
  const conn = ZONE_CONNECTIONS.find(
    (c) =>
      (c.from === from && c.to === to) || (c.from === to && c.to === from)
  );
  return conn?.locked ?? true; // Unknown paths default to locked
}
