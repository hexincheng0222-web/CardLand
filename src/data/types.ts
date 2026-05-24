// ============================================================
// CardLand V1 Type Definitions
// Authoritative types for all game data
// ============================================================

// --- Core Attributes (7 total, NO 体温) ---
export type AttributeId =
  | '饱食度'
  | '口渴度'
  | '体力值'
  | '健康值'
  | '精力值'
  | '污垢'
  | '心情';

export interface AttributeDef {
  id: AttributeId;
  name: string;
  icon: string;
  initialValue: number;
  maxValue: number;
  minValue: number;
  naturalDecayPerTurn: number; // positive = decrease, negative = increase
  isNegativeWhenHigh: boolean; // true for 污垢 (high is bad)
}

// --- Items (16+ types per 物资图鉴 v0.9) ---
export type ItemId =
  | '食物'
  | '水'
  | '草药'
  | '解毒草'
  | '蛇胆'
  | '木材'
  | '石材'
  | '纤维'
  | '布料'
  | '粘土'
  | '铁矿'
  | '硫磺'
  | '黑曜石'
  | '绳索'
  | '金属件'
  | '高级材料'
  | '工具'
  | '藏宝图'
  | '渔网'
  | '石刀'
  | '木矛'
  | '布甲'
  | '皮甲'
  | '火把'
  | '修理工具'
  | '简易营地'
  | '工作台'
  | '药膏'
  | '解毒剂'
  | '木筏'
  | '捕鱼陷阱';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  category: '生存' | '建材' | '矿石' | '特殊' | '装备' | '药剂' | '工具' | '建筑';
  weight: number;       // per 物资图鉴 v0.9 (authoritative)
  stackLimit: number;
  description: string;
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

// --- Zones A and B only (16 points each = 32 total) ---
export type ZoneId = 'A' | 'B'; // V1 scope only
export type SubZoneId = 'A1' | 'A2' | 'A3' | 'A4' | 'B1' | 'B2' | 'B3' | 'B4';
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
export type WeatherId = '晴' | '阴' | '雨' | '暴雨';

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

// --- Status Effects (8 total: 5 negative + 3 positive) ---
export type StatusEffectId =
  | '中毒'
  | '感染'
  | '迷路'
  | '疲惫'
  | '饱腹'
  | '精神饱满'
  | '专注'
  | '防护';

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

// --- Combat Strategies (6 total, V1 - NO 恐吓/潜行击) ---
export type CombatStrategyId =
  | '普通攻击'
  | '猛击'
  | '闪避姿态'
  | '格挡'
  | '精准攻击'
  | '撤退';

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
}

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