export interface StoryChapter {
  chapter: number;
  title: string;
  opponentId: string;
  stage: 'temple' | 'titan_hall';
  isBoss: boolean;
  rewardCoins: number;
}

export const STORY_CHAPTERS: StoryChapter[] = [
  { chapter: 1, title: 'Chapter I: Bamboo Trial', opponentId: 'oboro', stage: 'temple', isBoss: false, rewardCoins: 150 },
  { chapter: 2, title: 'Chapter II: Lotus Dojo', opponentId: 'rin', stage: 'temple', isBoss: false, rewardCoins: 180 },
  { chapter: 3, title: 'Chapter III: Night Claws', opponentId: 'kitsune', stage: 'temple', isBoss: false, rewardCoins: 220 },
  { chapter: 4, title: 'Chapter IV: Iron Shogunate', opponentId: 'tetsuo', stage: 'temple', isBoss: false, rewardCoins: 260 },
  { chapter: 5, title: 'Chapter V: Mountain Gate', opponentId: 'daichi', stage: 'titan_hall', isBoss: false, rewardCoins: 300 },
  { chapter: 6, title: 'Chapter VI: Crimson Demon', opponentId: 'asura', stage: 'titan_hall', isBoss: true, rewardCoins: 380 },
  { chapter: 7, title: 'Final Chapter: Void Overlord', opponentId: 'kaelor', stage: 'titan_hall', isBoss: true, rewardCoins: 600 },
];

export interface ChallengeDef {
  id: string;
  title: string;
  desc: string;
  opponentId: string;
  stage: 'temple' | 'titan_hall';
  eclipse: boolean;
  noBlock: boolean;
}

export const CHALLENGES: ChallengeDef[] = [
  { id: 'eclipse_fury', title: 'Eclipse Fury', desc: 'Defeat Asura under Eclipse pressure.', opponentId: 'asura', stage: 'titan_hall', eclipse: true, noBlock: false },
  { id: 'glass_blade', title: 'No Guard Duel', desc: 'Defeat Vipera without blocking.', opponentId: 'vipera', stage: 'temple', eclipse: false, noBlock: true },
  { id: 'overlord_trial', title: 'Overlord Trial', desc: 'Survive Kaelor in the Overlord Chamber.', opponentId: 'kaelor', stage: 'titan_hall', eclipse: true, noBlock: false },
];
