// ============================================================
// CardLand V1 Data Specification
// Authoritative single source of truth for all game data
// Resolves all conflicts between 4 design docs
// ============================================================

import type {
  AttributeDef,
  AttributeThreshold,
  AttributeLinkage,
  ItemDef,
  CraftingRecipe,
  EnemyDef,
  WeatherDef,
  StatusEffectDef,
  CombatStrategyDef,
  InitialHandDef,
  TurnResolutionStep,
} from './types';
import { MAP_POINTS, MOVEMENT_COSTS, ZONE_DANGER_RATES } from './map';

// ============================================================
// SECTION 1: CORE ATTRIBUTES (7 total, NO 体温)
// ============================================================

export const ATTRIBUTES: AttributeDef[] = [
  { id: '饱食度', name: '饱食度', icon: '🍖', initialValue: 60, maxValue: 100, minValue: 0, naturalDecayPerTurn: -3, isNegativeWhenHigh: false },
  { id: '口渴度', name: '口渴度', icon: '💧', initialValue: 60, maxValue: 100, minValue: 0, naturalDecayPerTurn: -5, isNegativeWhenHigh: false },
  { id: '体力值', name: '体力值', icon: '⚡', initialValue: 80, maxValue: 100, minValue: 0, naturalDecayPerTurn: 0, isNegativeWhenHigh: false },
  { id: '健康值', name: '健康值', icon: '❤️', initialValue: 100, maxValue: 100, minValue: 0, naturalDecayPerTurn: 0, isNegativeWhenHigh: false },
  { id: '精力值', name: '精力值', icon: '🧠', initialValue: 80, maxValue: 100, minValue: 0, naturalDecayPerTurn: -2, isNegativeWhenHigh: false },
  { id: '污垢', name: '污垢', icon: '🦠', initialValue: 20, maxValue: 100, minValue: 0, naturalDecayPerTurn: 3, isNegativeWhenHigh: true },
  { id: '心情', name: '心情', icon: '😊', initialValue: 70, maxValue: 100, minValue: 0, naturalDecayPerTurn: -2, isNegativeWhenHigh: false },
] as const;

// ============================================================
// SECTION 2: ATTRIBUTE THRESHOLDS
// ============================================================

export const ATTRIBUTE_THRESHOLDS: Record<string, AttributeThreshold[]> = {
  '饱食度': [
    { minValue: 0, maxValue: 30, effectId: '饱食度_极低', effectDescription: '行动效率 -50%，体力每回合额外 -3', efficiencyModifier: 0.5, recoveryModifier: 0 },
    { minValue: 31, maxValue: 60, effectId: '饱食度_低', effectDescription: '行动效率 -20%', efficiencyModifier: 0.8, recoveryModifier: 0 },
    { minValue: 61, maxValue: 80, effectId: '饱食度_正常', effectDescription: '正常', efficiencyModifier: 1, recoveryModifier: 0 },
    { minValue: 81, maxValue: 100, effectId: '饱食度_饱足', effectDescription: '行动效率 +10%，体力恢复 +2/回合', efficiencyModifier: 1.1, recoveryModifier: 2 },
  ],
  '口渴度': [
    { minValue: 0, maxValue: 30, effectId: '口渴度_极低', effectDescription: '行动效率 -40%，精力每回合额外 -3', efficiencyModifier: 0.6, recoveryModifier: 0 },
    { minValue: 31, maxValue: 60, effectId: '口渴度_低', effectDescription: '行动效率 -15%', efficiencyModifier: 0.85, recoveryModifier: 0 },
    { minValue: 61, maxValue: 80, effectId: '口渴度_正常', effectDescription: '正常', efficiencyModifier: 1, recoveryModifier: 0 },
    { minValue: 81, maxValue: 100, effectId: '口渴度_充足', effectDescription: '体力恢复 +1/回合', efficiencyModifier: 1, recoveryModifier: 1 },
  ],
  '体力值': [
    { minValue: 0, maxValue: 20, effectId: '体力值_极低', effectDescription: '无法战斗/采集，闪避率固定 10%', efficiencyModifier: 0, recoveryModifier: 0 },
    { minValue: 21, maxValue: 50, effectId: '体力值_低', effectDescription: '战斗消耗 +50%，闪避率 -15%', efficiencyModifier: 0.5, recoveryModifier: 0 },
    { minValue: 51, maxValue: 80, effectId: '体力值_正常', effectDescription: '正常', efficiencyModifier: 1, recoveryModifier: 0 },
    { minValue: 81, maxValue: 100, effectId: '体力值_充沛', effectDescription: '战斗消耗 -20%，闪避率 +10%', efficiencyModifier: 1, recoveryModifier: 0 },
  ],
  '健康值': [
    { minValue: 0, maxValue: 30, effectId: '健康值_濒死', effectDescription: '所有行动成功率 -30%，无法战斗', efficiencyModifier: 0.3, recoveryModifier: 0 },
    { minValue: 31, maxValue: 60, effectId: '健康值_受伤', effectDescription: '行动消耗 +20%，被击中伤害 +50%', efficiencyModifier: 0.8, recoveryModifier: 0 },
    { minValue: 61, maxValue: 80, effectId: '健康值_正常', effectDescription: '正常', efficiencyModifier: 1, recoveryModifier: 0 },
    { minValue: 81, maxValue: 100, effectId: '健康值_强壮', effectDescription: '受伤概率 -10%，恢复速度 +30%', efficiencyModifier: 1, recoveryModifier: 1.3 },
  ],
  '精力值': [
    { minValue: 0, maxValue: 30, effectId: '精力值_枯竭', effectDescription: '制作成功率 -50%，解谜不可用，采集产出 -30%', efficiencyModifier: 0.5, recoveryModifier: 0 },
    { minValue: 31, maxValue: 50, effectId: '精力值_不足', effectDescription: '采集成功率 -15%，制作消耗 +30%', efficiencyModifier: 0.85, recoveryModifier: 0 },
    { minValue: 51, maxValue: 80, effectId: '精力值_正常', effectDescription: '正常', efficiencyModifier: 1, recoveryModifier: 0 },
    { minValue: 81, maxValue: 100, effectId: '精力值_专注', effectDescription: '制作消耗 -20%，采集额外产出 +1', efficiencyModifier: 1, recoveryModifier: 0 },
  ],
  '污垢': [
    { minValue: 0, maxValue: 20, effectId: '污垢_清爽', effectDescription: '感染概率 -20%，心情恢复 +3/回合', efficiencyModifier: 0, recoveryModifier: 3 },
    { minValue: 21, maxValue: 50, effectId: '污垢_正常', effectDescription: '正常', efficiencyModifier: 0, recoveryModifier: 0 },
    { minValue: 51, maxValue: 80, effectId: '污垢_肮脏', effectDescription: '感染概率 +10%，心情恢复 -50%', efficiencyModifier: 0, recoveryModifier: -0.5 },
    { minValue: 81, maxValue: 100, effectId: '污垢_极脏', effectDescription: '感染概率 +25%，心情每回合 -5', efficiencyModifier: 0, recoveryModifier: -5 },
  ],
  '心情': [
    { minValue: 0, maxValue: 30, effectId: '心情_沮丧', effectDescription: '所有消耗 +30%，产出 -30%，不会自然恢复', efficiencyModifier: 0.7, recoveryModifier: 0 },
    { minValue: 31, maxValue: 50, effectId: '心情_低落', effectDescription: '行动消耗 +15%，采集产出 -10%', efficiencyModifier: 0.85, recoveryModifier: 0 },
    { minValue: 51, maxValue: 80, effectId: '心情_正常', effectDescription: '正常', efficiencyModifier: 1, recoveryModifier: 0 },
    { minValue: 81, maxValue: 100, effectId: '心情_愉悦', effectDescription: '所有消耗 -20%，突发危险概率 -5%，稀有发现概率 +5%', efficiencyModifier: 0.8, recoveryModifier: 0 },
  ],
} as const;

// ============================================================
// SECTION 3: ATTRIBUTE LINKAGES
// ============================================================

export const ATTRIBUTE_LINKAGES: AttributeLinkage[] = [
  // 饱食度联动
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: -0.5, modifierType: 'recovery' },
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '精力值', modifier: -3, modifierType: 'rate' },
  { triggerAttribute: '饱食度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '心情', modifier: -3, modifierType: 'rate' },
  // 口渴度联动
  { triggerAttribute: '口渴度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: 0.3, modifierType: 'consumption' },
  { triggerAttribute: '口渴度', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '健康值', modifier: -0.5, modifierType: 'recovery' },
  // 体力值联动
  { triggerAttribute: '体力值', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '精力值', modifier: 0.3, modifierType: 'consumption' },
  { triggerAttribute: '体力值', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '心情', modifier: -2, modifierType: 'rate' },
  // 健康值联动
  { triggerAttribute: '健康值', triggerCondition: 'leq', triggerValue: 40, affectedAttribute: '体力值', modifier: -20, modifierType: 'consumption' },
  { triggerAttribute: '健康值', triggerCondition: 'leq', triggerValue: 40, affectedAttribute: '心情', modifier: -3, modifierType: 'rate' },
  // 精力值联动
  { triggerAttribute: '精力值', triggerCondition: 'leq', triggerValue: 50, affectedAttribute: '体力值', modifier: -0.15, modifierType: 'efficiency' },
  { triggerAttribute: '精力值', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '精力值', modifier: -0.2, modifierType: 'consumption' },
  // 污垢联动
  { triggerAttribute: '污垢', triggerCondition: 'gt', triggerValue: 60, affectedAttribute: '健康值', modifier: -0.3, modifierType: 'recovery' },
  { triggerAttribute: '污垢', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '体力值', modifier: 0.15, modifierType: 'consumption' },
  // 心情联动
  { triggerAttribute: '心情', triggerCondition: 'leq', triggerValue: 30, affectedAttribute: '体力值', modifier: 0.2, modifierType: 'consumption' },
  { triggerAttribute: '心情', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '体力值', modifier: 3, modifierType: 'recovery' },
  { triggerAttribute: '心情', triggerCondition: 'gt', triggerValue: 80, affectedAttribute: '精力值', modifier: 2, modifierType: 'recovery' },
] as const;

// ============================================================
// SECTION 4: ITEMS (16 types per 物资图鉴 v0.9)
// ============================================================

export const ITEMS: ItemDef[] = [
  // 生存物资
  { id: '食物', name: '食物', icon: '🍖', category: '生存', weight: 2, stackLimit: 10, description: '充饥，恢复饱食度' },
  { id: '水', name: '水', icon: '💧', category: '生存', weight: 3, stackLimit: 5, description: '解渴，恢复口渴度' },
  { id: '草药', name: '草药', icon: '🌿', category: '生存', weight: 1, stackLimit: 10, description: '制作药膏、解毒剂、火把' },
  { id: '解毒草', name: '解毒草', icon: '☘️', category: '生存', weight: 1, stackLimit: 5, description: '制作解毒剂，解除中毒' },
  { id: '蛇胆', name: '蛇胆', icon: '🐍', category: '生存', weight: 1, stackLimit: 3, description: '解除高级蛇毒' },
  // 建材物资
  { id: '木材', name: '木材', icon: '🪵', category: '建材', weight: 5, stackLimit: 5, description: '工具/建筑/火把核心材料' },
  { id: '石材', name: '石材', icon: '🪨', category: '建材', weight: 8, stackLimit: 3, description: '加固建筑、窑炉/熔炉' },
  { id: '纤维', name: '纤维', icon: '🧵', category: '建材', weight: 1, stackLimit: 10, description: '合成绳索、防具、建筑' },
  { id: '布料', name: '布料', icon: '🧶', category: '建材', weight: 2, stackLimit: 5, description: '制作布甲/皮甲/绷带（含兽皮）' },
  { id: '粘土', name: '粘土', icon: '🏺', category: '建材', weight: 5, stackLimit: 5, description: '烧制陶罐、建造窑炉/熔炉' },
  // 矿石物资
  { id: '铁矿', name: '铁矿', icon: '⛏️', category: '矿石', weight: 6, stackLimit: 5, description: '冶炼铁斧/铁镐（核心金属）' },
  { id: '硫磺', name: '硫磺', icon: '💨', category: '矿石', weight: 3, stackLimit: 5, description: '制作火把、火药' },
  { id: '黑曜石', name: '黑曜石', icon: '🗡️', category: '矿石', weight: 4, stackLimit: 3, description: '冶炼黑曜石刀（顶级武器）' },
  // 特殊物资
  { id: '绳索', name: '绳索', icon: '🪢', category: '特殊', weight: 3, stackLimit: 3, description: '攀爬/制作木矛/木筏（可合成）' },
  { id: '金属件', name: '金属件', icon: '🔩', category: '特殊', weight: 4, stackLimit: 5, description: '修理工具、建造工作台' },
  { id: '高级材料', name: '高级材料', icon: '💎', category: '特殊', weight: 2, stackLimit: 10, description: '交易/装饰/终极奖励' },
  { id: '工具', name: '工具', icon: '🔧', category: '特殊', weight: 5, stackLimit: 1, description: '随机成品工具（探索获得）' },
  { id: '藏宝图', name: '藏宝图', icon: '🗺️', category: '特殊', weight: 1, stackLimit: 1, description: '解锁隐藏点位（一次性）' },
  { id: '渔网', name: '渔网', icon: '🥅', category: '特殊', weight: 3, stackLimit: 1, description: '制作捕鱼陷阱（可修理）' },
] as const;

// ============================================================
// SECTION 5: CRAFTING RECIPES (Tier 0 and Tier 1 only)
// ============================================================

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Tier 0 - 空手可做
  { productId: '绳索', productQuantity: 1, ingredients: [{ itemId: '纤维', quantity: 3 }], station: 'none', craftingTime: 1 },
  { productId: '工具', productQuantity: 1, ingredients: [{ itemId: '木材', quantity: 2 }, { itemId: '石材', quantity: 1 }], station: 'none', craftingTime: 2, durability: 15, effect: '攻击力+5' },
  { productId: '布料', productQuantity: 1, ingredients: [{ itemId: '纤维', quantity: 2 }], station: 'none', craftingTime: 1 },
  // 工具类
  { productId: '工具', productQuantity: 1, ingredients: [{ itemId: '木材', quantity: 2 }, { itemId: '绳索', quantity: 1 }], station: 'none', craftingTime: 2, durability: 8, effect: '攻击力+5，可投掷' },
  // 防具类
  { productId: '布料', productQuantity: 1, ingredients: [{ itemId: '纤维', quantity: 2 }, { itemId: '绳索', quantity: 1 }], station: 'none', craftingTime: 1, durability: 10, effect: '防御力+5' },
  // 消耗品类
  { productId: '草药', productQuantity: 1, ingredients: [{ itemId: '草药', quantity: 2 }], station: 'none', craftingTime: 1, effect: '治疗感染，健康+10' },
  { productId: '解毒草', productQuantity: 1, ingredients: [{ itemId: '解毒草', quantity: 1 }], station: 'none', craftingTime: 1, effect: '立即解除中毒' },
  { productId: '工具', productQuantity: 1, ingredients: [{ itemId: '木材', quantity: 1 }, { itemId: '纤维', quantity: 2 }], station: 'none', craftingTime: 1, durability: 5, effect: '照明5回合，洞穴探索必备' },
  // 建筑类
  { productId: '工具', productQuantity: 1, ingredients: [{ itemId: '木材', quantity: 4 }, { itemId: '纤维', quantity: 2 }], station: 'none', craftingTime: 1, effect: '休息恢复体力+40%，精力+20' },
  // Tier 1 - 需要工作台
  { productId: '布料', productQuantity: 1, ingredients: [{ itemId: '布料', quantity: 2 }, { itemId: '纤维', quantity: 2 }], station: 'workbench', craftingTime: 2, durability: 25, effect: '防御力+10' },
  { productId: '工具', productQuantity: 1, ingredients: [{ itemId: '铁矿', quantity: 2 }, { itemId: '纤维', quantity: 1 }], station: 'workbench', craftingTime: 2, durability: 5, effect: '修复任意工具+10耐久' },
  { productId: '工具', productQuantity: 1, ingredients: [{ itemId: '木材', quantity: 3 }, { itemId: '金属件', quantity: 1 }], station: 'workbench', craftingTime: 2, effect: '休息恢复体力+60%，精力+30，防风雨' },
  { productId: '绳索', productQuantity: 1, ingredients: [{ itemId: '木材', quantity: 3 }, { itemId: '绳索', quantity: 2 }], station: 'workbench', craftingTime: 3, effect: '解锁浅海探索' },
  { productId: '渔网', productQuantity: 1, ingredients: [{ itemId: '渔网', quantity: 1 }, { itemId: '木材', quantity: 1 }], station: 'workbench', craftingTime: 2, durability: 10, effect: '鱼产量+1，自动捕鱼' },
] as const;

// ============================================================
// SECTION 6: WEATHER TYPES (4 types, V1 only)
// ============================================================

export const WEATHER_TYPES: WeatherDef[] = [
  { id: '晴', name: '晴天', icon: '☀️', duration: 3, probability: 0.33, effects: { attributeEffects: [{ attributeId: '口渴度', amount: -3 }], specialEffects: ['口渴消耗+3/回合'] } },
  { id: '阴', name: '阴天', icon: '☁️', duration: 3, probability: 0.33, effects: { attributeEffects: [{ attributeId: '心情', amount: -1 }], specialEffects: ['无明显影响'] } },
  { id: '雨', name: '雨天', icon: '🌧️', duration: 2, probability: 0.17, effects: { attributeEffects: [{ attributeId: '饱食度', amount: -1 }, { attributeId: '污垢', amount: -5 }], specialEffects: ['饱食消耗+1/回合', '污垢-5/回合', '采集产出-20%'] } },
  { id: '暴雨', name: '暴雨', icon: '⛈️', duration: 2, probability: 0.17, effects: { attributeEffects: [{ attributeId: '体力值', amount: -10 }, { attributeId: '心情', amount: -3 }], specialEffects: ['无法探索（强制回庇护所）', '污垢-20/回合', '沼泽/浅海危险+30%'] } },
] as const;

// ============================================================
// SECTION 7: STATUS EFFECTS (8 total: 5 negative + 3 positive)
// ============================================================

export const STATUS_EFFECTS: StatusEffectDef[] = [
  // 负面状态
  { id: '中毒', name: '中毒', icon: '☠️', isNegative: true, duration: 3, damagePerTurn: -10, source: '蛇咬、水母蜇、硫磺毒气、沼气、腐败食物', effectDescription: '每回合健康 -10，持续 3 回合', removalMethods: ['解毒草×1 立即解除'] },
  { id: '感染', name: '感染', icon: '🩹', isNegative: true, duration: 5, damagePerTurn: -5, source: '伤口未处理、腐烂椰堆蚊虫、蝙蝠、污垢>80', effectDescription: '每回合健康 -5，持续 5 回合', removalMethods: ['草药×1 立即解除'] },
  { id: '灼伤', name: '灼伤', icon: '🔥', isNegative: true, duration: 2, damagePerTurn: -8, source: '火山热气喷口、熔岩管、蒸汽裂口', effectDescription: '每回合健康 -8，持续 2 回合', removalMethods: ['草药×1', '温泉'] },
  { id: '迷路', name: '迷路', icon: '🌫️', isNegative: true, duration: 1, damagePerTurn: -10, source: '迷雾沼泽、丛林深处', effectDescription: '本回合无法移动，体力 -10', removalMethods: ['藏宝图/指南针或休息'] },
  { id: '疲惫', name: '疲惫', icon: '😫', isNegative: true, duration: null, damagePerTurn: 0, source: '精力归零持续3回合', effectDescription: '精力消耗翻倍，行动力 -30%', removalMethods: ['休息点休息'] },
  { id: '沮丧', name: '沮丧', icon: '😞', isNegative: true, duration: null, damagePerTurn: 0, source: '心情归零持续2回合', effectDescription: '心情不再自然恢复，产出 -20%', removalMethods: ['发现稀有物资或休息+美食'] },
  // 正面状态
  { id: '饱腹', name: '饱腹', icon: '😋', isNegative: false, duration: null, damagePerTurn: 0, source: '饱食度>80', effectDescription: '每回合体力恢复 +5', removalMethods: ['饱食度≤80时自动解除'] },
  { id: '精神饱满', name: '精神饱满', icon: '✨', isNegative: false, duration: 1, damagePerTurn: 0, source: '充分休息', effectDescription: '本回合体力消耗减半', removalMethods: ['1回合后自动解除'] },
  { id: '专注', name: '专注', icon: '🎯', isNegative: false, duration: null, damagePerTurn: 0, source: '精力值>80', effectDescription: '制作/解谜消耗精力减半', removalMethods: ['精力值≤80时自动解除'] },
  { id: '防护', name: '防护', icon: '🛡️', isNegative: false, duration: null, damagePerTurn: 0, source: '使用布料/草药制作护具', effectDescription: '下次受到的状态效果减半', removalMethods: ['1次触发后消失'] },
] as const;

// ============================================================
// SECTION 8: COMBAT STRATEGIES (6 total, V1)
// ============================================================

export const COMBAT_STRATEGIES: CombatStrategyDef[] = [
  { id: '普通攻击', name: '普通攻击', icon: '⚔️', staminaCost: 10, energyCost: 0, damageMultiplier: 1, hitRateModifier: 0, dodgeRateBonus: 0, blockDamageReduction: 0, soundLevel: 'medium', description: '标准伤害，标准命中率', requirements: [] },
  { id: '猛击', name: '猛击', icon: '💥', staminaCost: 20, energyCost: 0, damageMultiplier: 2, hitRateModifier: -0.2, dodgeRateBonus: 0, blockDamageReduction: 0, soundLevel: 'loud', description: '伤害×2，命中率-20%', requirements: ['体力>40'] },
  { id: '闪避姿态', name: '闪避姿态', icon: '💨', staminaCost: 15, energyCost: 0, damageMultiplier: 0, hitRateModifier: 0, dodgeRateBonus: 0.25, blockDamageReduction: 0, soundLevel: 'silent', description: '本回合闪避率+25%，不攻击', requirements: [] },
  { id: '格挡', name: '格挡', icon: '🛡️', staminaCost: 8, energyCost: 0, damageMultiplier: 0, hitRateModifier: 0, dodgeRateBonus: 0, blockDamageReduction: 0.5, soundLevel: 'silent', description: '本回合减伤50%，不攻击', requirements: [] },
  { id: '精准攻击', name: '精准攻击', icon: '🎯', staminaCost: 12, energyCost: 10, damageMultiplier: 1.3, hitRateModifier: 0.2, dodgeRateBonus: 0, blockDamageReduction: 0, soundLevel: 'medium', description: '命中率+20%，伤害+30%', requirements: ['精力>30'] },
  { id: '撤退', name: '撤退', icon: '🏃', staminaCost: 20, energyCost: 0, damageMultiplier: 0, hitRateModifier: 0, dodgeRateBonus: 0, blockDamageReduction: 0, soundLevel: 'medium', description: '退出战斗，损失随机物资×1', requirements: [] },
] as const;

// ============================================================
// SECTION 9: ENEMY TIERS (3 tiers)
// ============================================================

export const ENEMIES: EnemyDef[] = [
  { tier: 'Small', name: '小野猪', icon: '🐗', hp: 10, atk: 3, def: 1, dodgeRate: 0.2, dropTable: [{ itemId: '食物', min: 1, max: 2, probability: 0.8 }, { itemId: '布料', min: 1, max: 1, probability: 0.3 }], moodBonus: 5, habitats: ['B1', 'B2'] },
  { tier: 'Small', name: '毒蛇', icon: '🐍', hp: 10, atk: 5, def: 1, dodgeRate: 0.25, dropTable: [{ itemId: '蛇胆', min: 1, max: 1, probability: 0.5 }, { itemId: '草药', min: 1, max: 2, probability: 0.6 }], moodBonus: 5, habitats: ['B1', 'B4'] },
  { tier: 'Medium', name: '野猪', icon: '🐗', hp: 20, atk: 7, def: 3, dodgeRate: 0.15, dropTable: [{ itemId: '食物', min: 2, max: 4, probability: 0.9 }, { itemId: '布料', min: 1, max: 2, probability: 0.5 }], moodBonus: 8, habitats: ['B1', 'B2'] },
  { tier: 'Large', name: '蛇王', icon: '🐍', hp: 35, atk: 12, def: 5, dodgeRate: 0.2, dropTable: [{ itemId: '蛇胆', min: 2, max: 3, probability: 1 }, { itemId: '高级材料', min: 1, max: 1, probability: 0.5 }], moodBonus: 15, habitats: ['B4'] },
] as const;

// ============================================================
// SECTION 10: INITIAL HANDS (4 types)
// ============================================================

export const INITIAL_HANDS: InitialHandDef[] = [
  { type: '生存型', name: '生存型', icon: '🍖', description: '开局生存更容易，资源较多', items: [{ itemId: '食物', quantity: 3 }, { itemId: '水', quantity: 2 }, { itemId: '草药', quantity: 1 }], totalWeight: 13, 特点: '适合新手' },
  { type: '探索型', name: '探索型', icon: '🗺️', description: '快速探索，发现隐藏点位', items: [{ itemId: '食物', quantity: 1 }, { itemId: '水', quantity: 1 }, { itemId: '绳索', quantity: 2 }, { itemId: '工具', quantity: 1 }, { itemId: '藏宝图', quantity: 1 }], totalWeight: 16, 特点: '适合老手' },
  { type: '制作型', name: '制作型', icon: '🔧', description: '制作材料丰富，适合建造', items: [{ itemId: '食物', quantity: 1 }, { itemId: '水', quantity: 1 }, { itemId: '木材', quantity: 2 }, { itemId: '纤维', quantity: 2 }, { itemId: '工具', quantity: 2 }], totalWeight: 22, 特点: '适合建造者' },
  { type: '战斗型', name: '战斗型', icon: '⚔️', description: '遭遇危险时更安全', items: [{ itemId: '食物', quantity: 1 }, { itemId: '水', quantity: 1 }, { itemId: '工具', quantity: 1 }, { itemId: '草药', quantity: 2 }], totalWeight: 10, 特点: '适合激进玩家' },
] as const;

// ============================================================
// SECTION 11-14: MAP, MOVEMENT, DANGER RATES
// All map-related constants now live in ./map.ts
// ============================================================

// ============================================================
// SECTION 12: TURN RESOLUTION ORDER (10-step pipeline)
// ============================================================

export const TURN_RESOLUTION_ORDER: TurnResolutionStep[] = [
  '天气判定',
  '自然衰减',
  '阈值效果',
  '联动效果',
  '状态效果',
  '行动执行',
  '事件触发',
  '耐久消耗',
  '属性clamp',
  '死亡检查',
] as const;

export const TURN_RESOLUTION_DESCRIPTION = `
CardLand V1 回合计resolution pipeline:
1. 天气判定: 检查天气是否需要切换，应用天气效果
2. 自然衰减: 应用基础属性衰减（饱食度-3，口渴度-5，精力-2，污垢+3，心情-2）
3. 阈值效果: 检查属性阈值，应用区间效果（效率修正、恢复修正）
4. 联动效果: 检查属性联动，应用跨属性修正
5. 状态效果: 应用状态效果（持续伤害/恢复，状态消退检查）
6. 行动执行: 执行玩家选择的行动（移动/采集/制作/休息/战斗）
7. 事件触发: 触发地图事件和随机事件
8. 耐久消耗: 消耗工具/武器/装备耐久度
9. 属性clamp: 确保所有属性在有效范围内 [0, maxValue]
10. 死亡检查: 检查是否满足死亡条件（健康值=0 等）
` as const;

// ============================================================
// SECTION 13-14: MOVEMENT COSTS & ZONE DANGER RATES
// Defined in ./map.ts and imported at the top of this file.
// ============================================================

// ============================================================
// EXPORT ALL DATA AS CONSTANTS
// ============================================================

export const V1_SPEC = {
  ATTRIBUTES,
  ATTRIBUTE_THRESHOLDS,
  ATTRIBUTE_LINKAGES,
  ITEMS,
  CRAFTING_RECIPES,
  WEATHER_TYPES,
  STATUS_EFFECTS,
  COMBAT_STRATEGIES,
  ENEMIES,
  INITIAL_HANDS,
  MAP_POINTS,
  TURN_RESOLUTION_ORDER,
  TURN_RESOLUTION_DESCRIPTION,
  MOVEMENT_COSTS,
  ZONE_DANGER_RATES,
} as const;

export default V1_SPEC;