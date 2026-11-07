import type { Attending, Award, Diet, Vibe, VideoCategory } from '../server/types';

export const ATTENDING_LABELS: Record<Attending, { label: string; blurb: string; emoji: string }> = {
  yes: { label: 'Yes!', blurb: 'Wouldn’t miss it', emoji: '🪔' },
  maybe: { label: 'Maybe', blurb: 'Keeping it mysterious', emoji: '🤔' },
  no: { label: 'No', blurb: 'Sadly, I can’t', emoji: '🥲' },
};

export const DIET_LABELS: Record<Diet, { label: string; emoji: string }> = {
  vegetarian: { label: 'Vegetarian', emoji: '🥗' },
  vegan: { label: 'Vegan', emoji: '🌱' },
  jain: { label: 'Jain', emoji: '🙏' },
  non_vegetarian: { label: 'Non-vegetarian', emoji: '🍗' },
  other: { label: 'Other', emoji: '✍️' },
};

export const CATEGORY_LABELS: Record<VideoCategory, { label: string; emoji: string }> = {
  funniest: { label: 'Funniest', emoji: '😂' },
  mind_blowing: { label: 'Most Mind-Blowing', emoji: '🤯' },
  wholesome: { label: 'Most Wholesome', emoji: '🥹' },
  wtf: { label: 'Most WTF', emoji: '😳' },
  hidden_gem: { label: 'Hidden Gem', emoji: '💎' },
  other: { label: 'Other', emoji: '✨' },
};

export const VIBE_LABELS: Record<Vibe, { label: string; emoji: string }> = {
  vibes: { label: 'Here for the vibes', emoji: '✨' },
  food: { label: 'Here for the food', emoji: '🍛' },
  gossip: { label: 'Here for the gossip', emoji: '👀' },
  dancing: { label: 'Here for the dancing', emoji: '💃' },
  invited: { label: 'Here because I was invited', emoji: '💌' },
  all: { label: 'All of the above', emoji: '🎆' },
};

export const AWARD_LABELS: Record<Award, { label: string; emoji: string; blurb: string }> = {
  funniest: { label: 'Funniest Video', emoji: '😂', blurb: 'Made us laugh the hardest' },
  mind_blowing: { label: 'Most Mind-Blowing', emoji: '🤯', blurb: 'Rearranged our brain cells' },
  wtf: { label: 'Most WTF', emoji: '😳', blurb: 'We have questions' },
  hidden_gem: { label: 'Hidden Gem', emoji: '💎', blurb: 'How has nobody seen this?' },
  peoples_champion: { label: 'People’s Champion', emoji: '🏆', blurb: 'The overall favourite' },
};
