export const DRAMA_STYLES = [
  { id: 'epic', label: 'Epic Fantasy', zh: '史诗奇幻', emoji: '⚔️', hint: '史诗、权谋、严肃庄重的气场,放进现代/日常场景形成强反差(如史诗英雄一本正经卖平价日用品)' },
  { id: 'palace', label: 'Palace Intrigue', zh: '宫斗权谋', emoji: '👑', hint: '深宫算计、步步为营、绵里藏针的台词张力' },
  { id: 'wuxia', label: 'Martial Arts Wuxia', zh: '武侠江湖', emoji: '🗡️', hint: '侠客恩怨、江湖道义、快意恩仇的气口' },
  { id: 'family', label: 'Family Drama', zh: '中式家庭', emoji: '🍜', hint: '催婚/见家长/丈母娘考验等中式家庭日常的夸张戏剧化(如社恐程序员见挑剔丈母娘)' },
  { id: 'office', label: 'Office Politics', zh: '职场斗争', emoji: '💼', hint: '办公室政治、KPI 内卷、老板的荒诞与打工人的心声' },
  { id: 'hero', label: 'Superhero', zh: '超级英雄', emoji: '🦸', hint: '拯救世界的宏大使命 vs 鸡毛蒜皮日常的强反差' },
] as const;

export type DramaStyle = (typeof DRAMA_STYLES)[number];
