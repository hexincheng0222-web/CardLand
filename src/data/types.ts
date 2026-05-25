// ============================================================
// CardLand V1 Type Definitions
// Authoritative types for all game data
// ============================================================

// --- Core Attributes (9 total: 7 original + 负重 + 体温) ---
export type AttributeId =
  | '饱食度'
  | '口渴度'
  | '体力值'
  | '健康值'
  | '精力值'
  | '污垢'
  | '心情'
  | '负重'
  | '体温';

export interface AttributeDef {
  id: AttributeId;
  name: string;
  icon: string;
  initialValue: number;
  maxValue: number;
  minValue: number;
  naturalDecayPerTurn?: number; // positive = decrease, negative = increase
  isNegativeWhenHigh: boolean; // true for 污垢 (high is bad)
}

// --- Items (per 物资图鉴 v1.0) ---
export type ItemId =
  // 生存物资
  | '食物'
  | '水'
  | '草药'
  | '解毒草'
  | '蛇胆'
  // 食材（可腐烂）
  | '生肉'
  | '熟肉'
  | '蛋'
  | '蟹贝'
  | '椰子'
  // 建材物资
  | '木材'
  | '石材'
  | '纤维'
  | '布料'
  | '粘土'
  // 矿石物资
  | '铁矿'
  | '硫磺'
  | '黑曜石'
  // 特殊物资
  | '绳索'
  | '金属件'
  | '高级材料'
  | '工具'
  | '藏宝图'
  | '渔网'
  | '盐块'
  | '兽皮'
  // 装备
  | '石斧'
  | '木矛'
  | '布甲'
  | '皮甲'
  // 工具/消耗品
  | '火把'
  | '修理工具'
  | '木筏'
  | '捕鱼陷阱'
  // 建筑
  | '简易营地'
  | '工作台'
  | '加固营地'
  | '窑炉'
  | '熔炉'
  // 药剂
  | '药膏'
  | '解毒剂'
  // 冶炼工具
  | '铁斧'
  | '铁镐'
  | '黑曜石刀'
  // 其他
  | '陶罐'
  | '绷带'
  | '火药'
  | '扩容背包';

export type ItemCategory = '生存' | '食材' | '建材' | '矿石' | '特殊' | '装备' | '药剂' | '工具' | '建筑';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  category: ItemCategory;
  weight: number;         // per 物资图鉴 v1.0 (authoritative)
  stackLimit: number;
  description: string;
  shelfLife?: number;     // 保质期（小时），null/undefined = 不腐烂
  repairable?: boolean;   // 是否可修理（耐久度系统）
}

// --- Perishable Items (food spoilage system) ---
export interface PerishableItem {
  itemId: ItemId;
  quantity: number;
  createdAt: number;      // totalMinutes from GameClock when created
  preservedBy?: PreservationMethod; // 保鲜处理方式
  adjustedShelfLife?: number; // 经保鲜处理后的保质期（小时）
}

export type PreservationMethod = '烹饪' | '腌制' | '庇护所Lv2';

export interface SpoilageResult {
  spoiledItems: { itemIndex: number; itemId: ItemId; penalty: SpoilagePenalty }[];
  totalChecked: number;
}

export interface SpoilagePenalty {
  type: '中毒' | '效果衰减' | '无';
  poisonChance?: number;  // 0-1, 中毒概率
  effectReduction?: number; // 0-1, 效果衰减比例
}

// --- Crafting Recipes ---
export type CraftingStation = 'none' | 'workbench' | 'kiln' | 'furnace';

export interface CraftingRecipe {
  productId: ItemId;
  productQuantity: number;
  ingredients: { itemId: ItemId; quantity: number }[];
  station: CraftingStation;
  craftingTime: number; // in turns
  durability?: number;  // for tools/weapons/armor
  effect?: string;
}

// --- Recipe (P1.6 blueprint-based crafting system) ---
export type RecipeCategory = '装备' | '工具' | '建筑' | '药剂' | '材料';

export interface Recipe {
  id: string;
  productId: string;
  productQuantity: number;
  ingredients: { itemId: string; quantity: number }[];
  station: CraftingStation;
  baseTime: number;           // minutes
  blueprintRequired: string | null; // null = always available
  category: RecipeCategory;
}

// --- All 6 zones (16 points each = 96 total) ---
export type ZoneId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type SubZoneId =
  | 'A1' | 'A2' | 'A3' | 'A4'
  | 'B1' | 'B2' | 'B3' | 'B4'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'D1' | 'D2' | 'D3' | 'D4'
  | 'E1' | 'E2' | 'E3' | 'E4'
  | 'F1' | 'F2' | 'F3' | 'F4';
export type Direction = 'north' | 'south' | 'east' | 'west';
export type PointType = '资源点' | '休息点' | '事件点' | '危险点' | '障碍点';

export interface MapPoint {
  id: string;              // e.g. "A1-north"
  zone: ZoneId;
  subZone: SubZoneId;
  direction: Direction;
  name: string;
  type: PointType;
  description: string;
  outputs: { itemId: ItemId; min: number; max: number }[];
  risks: string[];
  choiceEvents: ChoiceEvent[];
  staminaCost: number;     // movement cost to reach this point
  dangerLevel: number;     // 1-5 stars
  enemyTier: EnemyTier | null; // null if no combat possible
}

export interface ChoiceOption {
  id: string;
  label: string;
  icon: string;
  requirements: { itemId?: ItemId; attributeId?: AttributeId; minValue?: number }[];
  outcomes: ChoiceOutcome[];
}

export interface ChoiceOutcome {
  type: 'success' | 'failure' | 'partial';
  probability?: number; // 0-1, if undefined = 100%
  itemChanges?: { itemId: ItemId; quantity: number }[];
  attributeChanges?: { attributeId: AttributeId; amount: number }[];
  statusEffects?: StatusEffectId[];
  message: string;
}

export interface ChoiceEvent {
  id: string;
  name: string;
  icon: string;
  description: string;
  triggerChance: number; // 0-1
  options: ChoiceOption[];
}

// --- Weather (4 types only, V1) ---
export type WeatherId = '晴' | '阴' | '雨' | '暴雨' | '大雾' | '酷热';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  icon: string;
  duration: number;       // in turns
  probability: number;     // 0-1, for d6 roll
  effects: {
    attributeEffects: { attributeId: AttributeId; amount: number }[];
    specialEffects: string[];
  };
}

// --- Status Effects (21 total: 13 negative + 8 positive) ---
export type StatusEffectId =
  // Negative (13)
  | '中毒'
  | '感染'
  | '灼伤'
  | '迷路'
  | '溺水'
  | '蛇毒'
  | '疾病'
  | '疲惫'
  | '沮丧'
  | '失温症'
  | '中暑'
  | '湿身'
  | '饮食单调'
  // Positive (8)
  | '饱腹'
  | '精神饱满'
  | '专注'
  | '清爽'
  | '愉悦'
  | '防护'
  | '探索者之眼'
  | '暖身';

export interface StatusEffectDef {
  id: StatusEffectId;
  name: string;
  icon: string;
  isNegative: boolean;
  duration: number | null;        // in turns (-1 = while condition met, null = conditional)
  damagePerTurn: number;    // health damage per turn (negative for negative status)
  source: string;
  effectDescription: string;
  removalMethods: string[];
}

// --- Combat Strategies (8 total, V1) ---
export type CombatStrategyId =
  | '普通攻击'
  | '猛击'
  | '闪避姿态'
  | '格挡'
  | '精准攻击'
  | '恐吓'
  | '撤退'
  | '潜行击';

export interface CombatStrategyDef {
  id: CombatStrategyId;
  name: string;
  icon: string;
  staminaCost: number;
  energyCost: number;
  damageMultiplier: number;  // 1.0 = normal
  hitRateModifier: number;   // to base hit rate
  dodgeRateBonus: number;    // additional dodge %
  blockDamageReduction: number; // 0-1
  soundLevel: 'silent' | 'medium' | 'loud';
  description: string;
  requirements: string[];
  /** 恐吓: 50% chance to scare beasts away (no loot) */
  isIntimidate?: boolean;
  /** 潜行击: guaranteed first strike, +20% dodge */
  stealthFirstStrike?: boolean;
}

// --- Noise System ---
export type NoiseLevel = 'none' | 'small' | 'medium' | 'large';

export type NoiseAction =
  | '普通移动'
  | '采集'
  | '采矿'
  | '砍伐'
  | '战斗'
  | '潜行移动';

// --- Enemy Tiers (3 tiers) ---
export type EnemyTier = 'Small' | 'Medium' | 'Large';

export interface EnemyDef {
  tier: EnemyTier;
  name: string;
  icon: string;
  hp: number;
  atk: number;
  def: number;
  dodgeRate: number;        // base dodge %
  dropTable: { itemId: ItemId; min: number; max: number; probability: number }[];
  moodBonus: number;        // mood change on victory
  habitats: SubZoneId[];     // which sub-zones this enemy can spawn in
}

// --- Initial Hand Options (4 types) ---
export type HandType = '生存型' | '探索型' | '制作型' | '战斗型';

export interface InitialHandDef {
  type: HandType;
  name: string;
  icon: string;
  description: string;
  items: { itemId: ItemId; quantity: number }[];
  totalWeight: number;
  特点: string;
}

// --- Turn Resolution Order (10-step pipeline) ---
export type TurnResolutionStep =
  | '天气判定'
  | '自然衰减'
  | '阈值效果'
  | '联动效果'
  | '状态效果'
  | '行动执行'
  | '事件触发'
  | '耐久消耗'
  | '属性clamp'
  | '死亡检查';

export interface TurnResolutionPipeline {
  steps: TurnResolutionStep[];
  stepCount: number;
  description: string;
}

// --- Attribute Thresholds ---
export interface AttributeThreshold {
  minValue: number;
  maxValue: number;
  effectId: string;
  effectDescription: string;
  efficiencyModifier: number;   // action efficiency multiplier
  recoveryModifier: number;     // natural recovery modifier
}

// --- Attribute Linkages ---
export interface AttributeLinkage {
  triggerAttribute: AttributeId;
  triggerCondition: 'leq' | 'geq' | 'eq' | 'gt' | 'lt';
  triggerValue: number;
  affectedAttribute: AttributeId;
  modifier: number;            // e.g., -0.5 for -50%, 0.3 for +30%
  modifierType: 'consumption' | 'recovery' | 'efficiency' | 'rate';
}

// --- Movement Costs ---
export interface MovementCost {
  from: ZoneId | SubZoneId;
  to: ZoneId | SubZoneId;
  staminaCost: number;
  requirements: { itemId?: ItemId; condition?: string }[];
}