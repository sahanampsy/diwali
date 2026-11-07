import type { Attending, Award, Diet, LookingForward, VideoCategory } from '../server/types';

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

export const LOOKING_FORWARD_LABELS: Record<LookingForward, { label: string; emoji: string }> = {
  cats: { label: 'Meeting the cats', emoji: '🐈' },
  board_games: { label: 'Playing board games', emoji: '🎲' },
  cocktails: { label: 'Cocktails', emoji: '🍸' },
  watch_party: { label: 'The watch party', emoji: '📺' },
  everything: { label: 'Everything!', emoji: '🎆' },
};

export const AWARD_LABELS: Record<Award, { label: string; emoji: string; blurb: string }> = {
  funniest: { label: 'Funniest Video', emoji: '😂', blurb: 'Made us laugh the hardest' },
  mind_blowing: { label: 'Most Mind-Blowing', emoji: '🤯', blurb: 'Rearranged our brain cells' },
  wtf: { label: 'Most WTF', emoji: '😳', blurb: 'We have questions' },
  hidden_gem: { label: 'Hidden Gem', emoji: '💎', blurb: 'How has nobody seen this?' },
  peoples_champion: { label: 'People’s Champion', emoji: '🏆', blurb: 'The overall favourite' },
};
