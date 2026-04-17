/**
 * Achievement definitions for GRVD.
 *
 * Organized by category (creation / performance / reputation / collab) and
 * tier (beginner / medium / advanced) — matching the in-game achievement board.
 *
 * Each entry includes:
 *   • trigger  — the condition checked automatically in the store
 *   • xpReward — bonus XP awarded when the achievement is first unlocked
 *   • unrealReward — spec for the Unreal Engine 5 NPC item-reward system.
 *                    When a player visits the designated NPC with this
 *                    achievement unlocked, the NPC hands them the item.
 *                    itemType maps to UE5 asset categories in the game project.
 */

import type { LayerKind } from "./types";

/* -------------------------------------------------------------------------- */
/* Types                                                                        */
/* -------------------------------------------------------------------------- */

export type AchievementCategory = "creation" | "performance" | "reputation" | "collab";
export type AchievementTier     = "beginner" | "medium" | "advanced";

export type AchievementTriggerType =
  | "first_song"           // first song saved
  | "song_count"           // inventory.length >= threshold
  | "vocal_count"          // vocalCount >= threshold
  | "has_layer_kind"       // saved a song that contained this kind
  | "layer_count_in_song"  // saved a song with >= threshold layers
  | "pitch_score"          // a vocal recording scored >= threshold
  | "collab_count"         // saved >= threshold collab songs
  | "session_hours"        // cumulative session time >= threshold hours
  | "xp_total"             // totalXP >= threshold
  | "manual";              // triggered programmatically / future feature

export interface AchievementTrigger {
  type: AchievementTriggerType;
  threshold?: number;
  kind?: LayerKind;
}

export interface UnrealReward {
  /** UE5 blueprint/asset ID of the reward item */
  itemId: string;
  /** Human-readable display name */
  itemName: string;
  /** Asset category in the UE5 project */
  itemType: "outfit" | "prop" | "studio_item" | "emote" | "vehicle" | "accessory";
  /** NPC blueprint ID that hands out this reward */
  npcId: string;
  /** NPC display name shown in tooltip */
  npcName: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  /** Emoji icon */
  icon: string;
  /** Bonus XP granted when first unlocked */
  xpReward: number;
  /** Automatic unlock condition (undefined = manual only) */
  trigger: AchievementTrigger;
  /** Future Unreal Engine NPC item reward */
  unrealReward: UnrealReward;
}

/* -------------------------------------------------------------------------- */
/* Tier colors (used by UI)                                                     */
/* -------------------------------------------------------------------------- */

export const TIER_COLOR: Record<AchievementTier, string> = {
  beginner: "#4ade80",  // green
  medium:   "#facc15",  // gold
  advanced: "#f97316",  // orange-red
};

export const CATEGORY_COLOR: Record<AchievementCategory, string> = {
  creation:    "#7c3aed", // purple
  performance: "#db2777", // pink
  reputation:  "#f97316", // orange
  collab:      "#0ea5e9", // sky blue
};

/* -------------------------------------------------------------------------- */
/* Achievement definitions                                                      */
/* -------------------------------------------------------------------------- */

export const ACHIEVEMENTS: Achievement[] = [

  /* ════════════════ CREATION ════════════════ */

  // Beginner
  {
    id: "bedroom-producer",
    name: "Bedroom Producer",
    description: "Create your first beat in the DAW.",
    category: "creation", tier: "beginner", icon: "🖥️",
    xpReward: 50,
    trigger: { type: "first_song" },
    unrealReward: {
      itemId: "UA_StudioItem_PosterBedroom_001",
      itemName: "Bedroom Producer Poster",
      itemType: "studio_item",
      npcId: "NPC_RecordstoreOwner_001",
      npcName: "Vinyl Vic",
    },
  },
  {
    id: "mic-check",
    name: "Mic Check",
    description: "Record your first rap vocal.",
    category: "creation", tier: "beginner", icon: "🎤",
    xpReward: 75,
    trigger: { type: "vocal_count", threshold: 1 },
    unrealReward: {
      itemId: "UA_Prop_Microphone_Vintage_001",
      itemName: "Vintage Studio Mic",
      itemType: "prop",
      npcId: "NPC_RecordstoreOwner_001",
      npcName: "Vinyl Vic",
    },
  },
  {
    id: "first-drop",
    name: "First Drop",
    description: "Release your first song.",
    category: "creation", tier: "beginner", icon: "💿",
    xpReward: 100,
    trigger: { type: "song_count", threshold: 1 },
    unrealReward: {
      itemId: "UA_Prop_CD_Gold_001",
      itemName: "Gold CD Plaque",
      itemType: "prop",
      npcId: "NPC_RecordstoreOwner_001",
      npcName: "Vinyl Vic",
    },
  },
  {
    id: "loop-starter",
    name: "Loop Starter",
    description: "Build a beat using a sample loop.",
    category: "creation", tier: "beginner", icon: "🔄",
    xpReward: 50,
    trigger: { type: "has_layer_kind", kind: "sample" },
    unrealReward: {
      itemId: "UA_Prop_VinylCrate_001",
      itemName: "Vinyl Crate",
      itemType: "studio_item",
      npcId: "NPC_RecordstoreOwner_001",
      npcName: "Vinyl Vic",
    },
  },
  {
    id: "basic-mixer",
    name: "Basic Mixer",
    description: "Adjust volume levels on a track.",
    category: "creation", tier: "beginner", icon: "🎚️",
    xpReward: 30,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_MixerSmall_001",
      itemName: "Mini Mixer",
      itemType: "prop",
      npcId: "NPC_RecordstoreOwner_001",
      npcName: "Vinyl Vic",
    },
  },

  // Medium
  {
    id: "beat-architect",
    name: "Beat Architect",
    description: "Create 25 beats.",
    category: "creation", tier: "medium", icon: "🏗️",
    xpReward: 200,
    trigger: { type: "song_count", threshold: 25 },
    unrealReward: {
      itemId: "UA_Outfit_StudioJacket_Blueprint_001",
      itemName: "Blueprint Studio Jacket",
      itemType: "outfit",
      npcId: "NPC_Producer_001",
      npcName: "Beatz McBeat",
    },
  },
  {
    id: "808-prophet",
    name: "808 Prophet",
    description: "Create a bass-driven track with an 808.",
    category: "creation", tier: "medium", icon: "🔊",
    xpReward: 150,
    trigger: { type: "has_layer_kind", kind: "808" },
    unrealReward: {
      itemId: "UA_Prop_808Machine_001",
      itemName: "Classic 808 Machine",
      itemType: "prop",
      npcId: "NPC_Producer_001",
      npcName: "Beatz McBeat",
    },
  },
  {
    id: "layer-lord",
    name: "Layer Lord",
    description: "Stack 4 or more instruments in a single track.",
    category: "creation", tier: "medium", icon: "🎛️",
    xpReward: 175,
    trigger: { type: "layer_count_in_song", threshold: 4 },
    unrealReward: {
      itemId: "UA_Emote_LayerUp_001",
      itemName: "Layer Up Emote",
      itemType: "emote",
      npcId: "NPC_Producer_001",
      npcName: "Beatz McBeat",
    },
  },
  {
    id: "sample-surgeon",
    name: "Sample Surgeon",
    description: "Edit and manipulate samples on 10 tracks.",
    category: "creation", tier: "medium", icon: "🔬",
    xpReward: 175,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Outfit_SurgeonSuit_001",
      itemName: "Sample Surgeon Lab Coat",
      itemType: "outfit",
      npcId: "NPC_Producer_001",
      npcName: "Beatz McBeat",
    },
  },
  {
    id: "sound-alchemist",
    name: "Sound Alchemist",
    description: "Blend two genres in one track.",
    category: "creation", tier: "medium", icon: "⚗️",
    xpReward: 200,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_AlchemyFlask_001",
      itemName: "Neon Alchemy Flask",
      itemType: "prop",
      npcId: "NPC_Producer_001",
      npcName: "Beatz McBeat",
    },
  },

  // Advanced
  {
    id: "studio-rat",
    name: "Studio Rat",
    description: "Spend 50 hours producing in GRVD.",
    category: "creation", tier: "advanced", icon: "⏱️",
    xpReward: 500,
    trigger: { type: "session_hours", threshold: 50 },
    unrealReward: {
      itemId: "UA_Outfit_StudioRat_001",
      itemName: "Studio Rat Hoodie",
      itemType: "outfit",
      npcId: "NPC_LegendProducer_001",
      npcName: "The Legend",
    },
  },
  {
    id: "hitmaker",
    name: "Hitmaker",
    description: "Create a chart-topping song.",
    category: "creation", tier: "advanced", icon: "📈",
    xpReward: 500,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_ChartPlaque_001",
      itemName: "Platinum Chart Plaque",
      itemType: "studio_item",
      npcId: "NPC_LegendProducer_001",
      npcName: "The Legend",
    },
  },
  {
    id: "mad-scientist",
    name: "Mad Scientist",
    description: "Build an experimental track with unique sounds.",
    category: "creation", tier: "advanced", icon: "🧪",
    xpReward: 400,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Outfit_MadScientist_001",
      itemName: "Mad Scientist Lab Gear",
      itemType: "outfit",
      npcId: "NPC_LegendProducer_001",
      npcName: "The Legend",
    },
  },
  {
    id: "master-of-the-mix",
    name: "Master of the Mix",
    description: "Achieve perfect mix balance on a track.",
    category: "creation", tier: "advanced", icon: "⚖️",
    xpReward: 450,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_GoldenHeadphones_001",
      itemName: "Golden Headphones",
      itemType: "accessory",
      npcId: "NPC_LegendProducer_001",
      npcName: "The Legend",
    },
  },
  {
    id: "automation-wizard",
    name: "Automation Wizard",
    description: "Use advanced production techniques.",
    category: "creation", tier: "advanced", icon: "🪄",
    xpReward: 500,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Emote_AutomationWiz_001",
      itemName: "Wizard Wave Emote",
      itemType: "emote",
      npcId: "NPC_LegendProducer_001",
      npcName: "The Legend",
    },
  },

  /* ════════════════ PERFORMANCE ════════════════ */

  {
    id: "first-show",
    name: "First Show",
    description: "Perform in your first live event.",
    category: "performance", tier: "beginner", icon: "🎪",
    xpReward: 75,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_StageLight_001",
      itemName: "Stage Spotlight",
      itemType: "prop",
      npcId: "NPC_EventPromoter_001",
      npcName: "Big Stage Manny",
    },
  },
  {
    id: "open-mic",
    name: "Open Mic",
    description: "Participate in a rap battle.",
    category: "performance", tier: "beginner", icon: "🎙️",
    xpReward: 75,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_OpenMicSign_001",
      itemName: "Open Mic Night Sign",
      itemType: "prop",
      npcId: "NPC_EventPromoter_001",
      npcName: "Big Stage Manny",
    },
  },
  {
    id: "warm-up-act",
    name: "Warm-Up Act",
    description: "Perform before another player.",
    category: "performance", tier: "beginner", icon: "🔥",
    xpReward: 50,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Emote_WarmUp_001",
      itemName: "Warm-Up Dance Emote",
      itemType: "emote",
      npcId: "NPC_EventPromoter_001",
      npcName: "Big Stage Manny",
    },
  },
  {
    id: "flow-state",
    name: "Flow State",
    description: "Rap with near-perfect pitch for a full track.",
    category: "performance", tier: "medium", icon: "🌊",
    xpReward: 200,
    trigger: { type: "pitch_score", threshold: 88 },
    unrealReward: {
      itemId: "UA_Outfit_FlowState_001",
      itemName: "Flow State Tracksuit",
      itemType: "outfit",
      npcId: "NPC_EventPromoter_001",
      npcName: "Big Stage Manny",
    },
  },
  {
    id: "freestyle-fighter",
    name: "Freestyle Fighter",
    description: "Win a freestyle battle.",
    category: "performance", tier: "medium", icon: "⚔️",
    xpReward: 175,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_BattleGloves_001",
      itemName: "Battle Gloves",
      itemType: "prop",
      npcId: "NPC_EventPromoter_001",
      npcName: "Big Stage Manny",
    },
  },
  {
    id: "rap-contender",
    name: "Rap Contender",
    description: "Win 5 rap battles.",
    category: "performance", tier: "medium", icon: "🥊",
    xpReward: 250,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Outfit_ContenderBelt_001",
      itemName: "Contender Belt Accessory",
      itemType: "accessory",
      npcId: "NPC_EventPromoter_001",
      npcName: "Big Stage Manny",
    },
  },
  {
    id: "rap-gladiator",
    name: "Rap Gladiator",
    description: "Win 25 rap battles.",
    category: "performance", tier: "advanced", icon: "🏆",
    xpReward: 500,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Outfit_Gladiator_001",
      itemName: "Gladiator Stage Armor",
      itemType: "outfit",
      npcId: "NPC_LegendPerformer_001",
      npcName: "The Ringleader",
    },
  },
  {
    id: "bar-assassin",
    name: "Bar Assassin",
    description: "Land multiple high-scoring punchlines.",
    category: "performance", tier: "advanced", icon: "🗡️",
    xpReward: 400,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Emote_BarAssassin_001",
      itemName: "Punchline Drop Emote",
      itemType: "emote",
      npcId: "NPC_LegendPerformer_001",
      npcName: "The Ringleader",
    },
  },
  {
    id: "crowd-legend",
    name: "Crowd Legend",
    description: "Max out crowd hype during a major event.",
    category: "performance", tier: "advanced", icon: "👑",
    xpReward: 500,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_CrowdLegendCrown_001",
      itemName: "Crowd Legend Crown",
      itemType: "accessory",
      npcId: "NPC_LegendPerformer_001",
      npcName: "The Ringleader",
    },
  },
  {
    id: "rap-royalty",
    name: "Rap Royalty",
    description: "Reach the very top of the rap game.",
    category: "performance", tier: "advanced", icon: "♛",
    xpReward: 1000,
    trigger: { type: "xp_total", threshold: 5000 },
    unrealReward: {
      itemId: "UA_Outfit_RapRoyalty_001",
      itemName: "Rap Royalty Full Outfit",
      itemType: "outfit",
      npcId: "NPC_LegendPerformer_001",
      npcName: "The Ringleader",
    },
  },

  /* ════════════════ REPUTATION ════════════════ */

  {
    id: "local-artist",
    name: "Local Artist",
    description: "Gain a small fanbase — release 3 songs.",
    category: "reputation", tier: "beginner", icon: "📻",
    xpReward: 75,
    trigger: { type: "song_count", threshold: 3 },
    unrealReward: {
      itemId: "UA_Prop_LocalFlyer_001",
      itemName: "Local Artist Flyer",
      itemType: "prop",
      npcId: "NPC_FanAgent_001",
      npcName: "Street Promoter Zara",
    },
  },
  {
    id: "underground-buzz",
    name: "Underground Buzz",
    description: "A track gains strong underground popularity.",
    category: "reputation", tier: "beginner", icon: "📡",
    xpReward: 100,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_UndergroundPoster_001",
      itemName: "Underground Scene Poster",
      itemType: "studio_item",
      npcId: "NPC_FanAgent_001",
      npcName: "Street Promoter Zara",
    },
  },
  {
    id: "mixtape-hustler",
    name: "Mixtape Hustler",
    description: "Release 10 songs.",
    category: "reputation", tier: "medium", icon: "📼",
    xpReward: 200,
    trigger: { type: "song_count", threshold: 10 },
    unrealReward: {
      itemId: "UA_Prop_MixtapeTape_001",
      itemName: "Classic Mixtape",
      itemType: "prop",
      npcId: "NPC_FanAgent_001",
      npcName: "Street Promoter Zara",
    },
  },
  {
    id: "rising-star",
    name: "Rising Star",
    description: "Build a large fanbase — release 25 songs.",
    category: "reputation", tier: "medium", icon: "⭐",
    xpReward: 300,
    trigger: { type: "song_count", threshold: 25 },
    unrealReward: {
      itemId: "UA_Outfit_RisingStar_001",
      itemName: "Rising Star Jacket",
      itemType: "outfit",
      npcId: "NPC_FanAgent_001",
      npcName: "Street Promoter Zara",
    },
  },
  {
    id: "street-legend",
    name: "Street Legend",
    description: "Reach the top of the leaderboard.",
    category: "reputation", tier: "medium", icon: "🏙️",
    xpReward: 350,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Vehicle_StreetLegend_001",
      itemName: "Street Legend Lowrider",
      itemType: "vehicle",
      npcId: "NPC_FanAgent_001",
      npcName: "Street Promoter Zara",
    },
  },

  /* ════════════════ COLLAB ════════════════ */

  {
    id: "studio-session",
    name: "Studio Session",
    description: "Collaborate with another player on a track.",
    category: "collab", tier: "beginner", icon: "🤝",
    xpReward: 100,
    trigger: { type: "collab_count", threshold: 1 },
    unrealReward: {
      itemId: "UA_Prop_CollabMic_001",
      itemName: "Collab Booth Microphone",
      itemType: "prop",
      npcId: "NPC_CollabAgent_001",
      npcName: "Link-Up Larry",
    },
  },
  {
    id: "first-feature",
    name: "First Feature",
    description: "Appear on someone else's track.",
    category: "collab", tier: "beginner", icon: "🎵",
    xpReward: 75,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_FeatureChain_001",
      itemName: "Feature Chain Necklace",
      itemType: "accessory",
      npcId: "NPC_CollabAgent_001",
      npcName: "Link-Up Larry",
    },
  },
  {
    id: "collab-king",
    name: "Collab King",
    description: "Release 3 collaboration tracks.",
    category: "collab", tier: "medium", icon: "🤜",
    xpReward: 250,
    trigger: { type: "collab_count", threshold: 3 },
    unrealReward: {
      itemId: "UA_Outfit_CollabKing_001",
      itemName: "Collab King Crown Set",
      itemType: "outfit",
      npcId: "NPC_CollabAgent_001",
      npcName: "Link-Up Larry",
    },
  },
  {
    id: "feature-machine",
    name: "Feature Machine",
    description: "Appear on 5 different tracks.",
    category: "collab", tier: "medium", icon: "🎯",
    xpReward: 200,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Emote_FeatureMachine_001",
      itemName: "Feature Machine Emote",
      itemType: "emote",
      npcId: "NPC_CollabAgent_001",
      npcName: "Link-Up Larry",
    },
  },
  {
    id: "crew-builder",
    name: "Crew Builder",
    description: "Create or lead a rap crew.",
    category: "collab", tier: "advanced", icon: "👥",
    xpReward: 400,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Prop_CrewFlag_001",
      itemName: "Crew Flag",
      itemType: "studio_item",
      npcId: "NPC_CrewBoss_001",
      npcName: "Don Cipher",
    },
  },
  {
    id: "industry-icon",
    name: "Industry Icon",
    description: "Collaborate with top-tier players.",
    category: "collab", tier: "advanced", icon: "🌐",
    xpReward: 600,
    trigger: { type: "manual" },
    unrealReward: {
      itemId: "UA_Outfit_IndustryIcon_001",
      itemName: "Industry Icon Suit",
      itemType: "outfit",
      npcId: "NPC_CrewBoss_001",
      npcName: "Don Cipher",
    },
  },
];

/** Look up a single achievement by ID */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/* -------------------------------------------------------------------------- */
/* XP rewards per action (used by store.addXP)                                 */
/* -------------------------------------------------------------------------- */

/** XP for locking in each layer kind */
export const LAYER_XP: Record<string, number> = {
  drums:  15,
  kick:   12,
  snare:  12,
  hat:    12,
  "808":  25,
  sample: 20,
  melody: 20,
  vocal:  0,  // vocal gives XP when recorded, not when "picked" in recipe
};

/** XP for recording a vocal take */
export const VOCAL_XP = 50;

/** XP for saving a finished song */
export const SAVE_SONG_XP = 100;
