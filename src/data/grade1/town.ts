/**
 * 拠点(村・集落など)のデータ。台本の「村人の小ネタ」表(C1-11 など)と、店の品ぞろえ。
 * 会話イベント(章クリア後の 1 回だけの会話)はスクリプト ID で参照する。
 */
export interface Villager {
  name: string;
  emoji: string;
  /** 章クリア前 / 後 のセリフ */
  before: string;
  after: string;
}

export interface TownDef {
  id: string;
  name: string;
  bg: string;
  /** この拠点が属する章(クリア前後の判定に使う) */
  chapterId: string;
  shop: { tools: string[]; gear: string[] };
  villagers: Villager[];
  /** 章クリア後に最初に入ったときの会話。1 回だけ(flag で管理) */
  afterClearScript?: { scriptId: string; flag: string };
  /** 復習の泉の名前(拠点ごとに呼び名が違う) */
  springName: string;
}

export const towns: Record<string, TownDef> = {
  village: {
    id: 'village',
    name: 'はじまりの村',
    bg: 'bg_village_square',
    chapterId: 'g1c1',
    shop: { tools: ['potion', 'hint_feather', 'time_sand', 'hi_potion'], gear: ['wooden_sword', 'cloth_armor', 'iron_sword', 'leather_shield'] },
    villagers: [
      { name: '男の子', emoji: '👦', before: '橋が 縮む前に 渡りっこしようぜ! …3人とも 落ちたけど', after: '橋が 直った! 今度は 縮まない。つまんねー' },
      { name: 'おばあさん', emoji: '👵', before: 'けさは 気温が −3度 だったそうな。昔は「寒い」で よかったのにねえ', after: '−3度は 0度より 3度 低いってことか。ピタさんに 教わったよ' },
      { name: '農夫', emoji: '👨‍🌾', before: 'ことしの 収穫は 去年より −20個 だと。増えたのか 減ったのか、分からん', after: '−20個は 20個 減ったってことだな。……減ったのは 悲しいが、分かって すっきりした' },
      { name: '旅人', emoji: '🧳', before: '北から来たんだ。北は もっとひどい。数どころか、形まで おかしい', after: '王都のほうも 騒がしいらしい。おれは しばらく この村にいるよ' },
      { name: '泉の番人', emoji: '🧙‍♀️', before: 'この泉は「修練の泉」。のぞきこむと、自分が 学んだ理が ぜんぶ 映るのさ。好きな理を えらんで、何度でも 言い直しに 来るといい', after: 'この泉は「修練の泉」。のぞきこむと、自分が 学んだ理が ぜんぶ 映るのさ。好きな理を えらんで、何度でも 言い直しに 来るといい' },
    ],
    afterClearScript: { scriptId: 'C1-10', flag: 'g1c1_village_done' },
    springName: '修練の泉',
  },

  village2: {
    id: 'village2',
    name: '羊飼いの集落',
    bg: 'bg_plain_village',
    chapterId: 'g1c2',
    shop: { tools: ['potion', 'hint_feather', 'time_sand', 'hi_potion'], gear: ['iron_sword', 'leather_shield', 'silver_sword'] },
    villagers: [
      { name: '羊飼いの少年', emoji: '🧑‍🌾', before: '羊が えーと、あの……あの数、いるんだ。あの数!', after: '羊は 1つの囲いに 12匹! おれの 囲いは 3つだから 36匹!' },
      { name: '風車番', emoji: '🧙', before: '風車の あれが、あれして、あれなんだ。……なんて 言えばいいんだっけ', after: '風車の 羽根が 回って 粉を ひくんだ。……言えた!' },
      { name: 'おばあさん', emoji: '👵', before: '孫の名前が 出てこなくてねえ。顔は 分かるのに', after: '孫の名前は トト。……あんまり 何度も 呼ぶから、いやがられたよ' },
      { name: '行商の若者', emoji: '🧳', before: '王都から来た。王都じゃ 最近、書記官が 何人も いなくなったって うわさだ', after: 'あの書記官、王都の 人だったのか。王都で なにが 起きてるんだろうな' },
      { name: 'テオ', emoji: '🧔', before: '荷車ごと 来たぜ。集落でも 商売は 商売だ', after: '売り買いが 戻った!「それ」じゃなくて「パン」って 言えるって 最高だな!' },
    ],
    afterClearScript: { scriptId: 'C2-10', flag: 'g1c2_village_done' },
    springName: '修練の泉',
  },
  camp3: {
    id: 'camp3',
    name: '野営地',
    bg: 'bg_cave_camp',
    chapterId: 'g1c3',
    shop: { tools: ['potion', 'hi_potion', 'hint_feather', 'time_sand'], gear: ['silver_sword', 'leather_shield'] },
    villagers: [
      { name: '洞窟守', emoji: '🧔‍♂️', before: '天秤の部屋は 全部で 七つ。一番奥のが 一番 大きい', after: '碑が 直ってから、洞窟の 壁が 明るくなった。ランプが いらねえ' },
      { name: 'メイ', emoji: '👧', before: '羊たちは 集落の みんなが 見ててくれてる。でも ベルがないと 夜が 心配で', after: 'エックスったら、また 光るもの 集めてる。今度は 返すのよ!' },
      { name: '荷運びの男', emoji: '🧑‍🔧', before: '集落の 鍋も 風車の 部品も、みんな 影に 持っていかれた', after: '返しに 行く 道具の 山だ。持ち主の 名前が 光ってるから 間違えねえ' },
      { name: '旅の騎士', emoji: '🛡️', before: '……王国の 者だ。北の様子を 調べている。ここから 北は、まだ 行くな', after: '碑を 直したのは 君か。……王都にも、君のような 力が 必要になるかもしれない' },
      { name: 'テオ', emoji: '🧔', before: 'オレも 影に やられた。靴下を 片方 持っていかれた。損した!', after: '靴下ーっ! 帰ってきた! 得した! ……いや、これも 元に戻っただけか' },
    ],
    afterClearScript: { scriptId: 'C3-11', flag: 'g1c3_camp_done' },
    springName: '修練の泉',
  },

  town4: {
    id: 'town4', name: '湖畔の町', bg: 'bg_lake_town', chapterId: 'g1c4',
    shop: { tools: ['potion', 'hi_potion', 'hint_feather', 'time_sand'], gear: ['silver_sword', 'leather_shield'] },
    villagers: [
      { name: '漁師の子', emoji: '🧒', before: '舟で 沖に 出たら、こいだ分の 2倍 進んだり、半分しか 進まなかったり', after: 'こいだ分だけ 進む。あたりまえが 一番だね' },
      { name: '水車職人の弟子', emoji: '🧑‍🔧', before: '歯車を 12枚から 24枚に したら、速さが……増えた? 減った? 分かんなくなった', after: '24枚なら 速さは 半分。x × y が いつも 同じ数。師匠に ほめられた' },
      { name: '宿屋の女将', emoji: '👩', before: '湖が 荒れてから、お客が さっぱり', after: 'お客が 戻ってきた。1人 増えるごとに 洗濯物も 増える。これも 比例かねえ' },
      { name: '北から来た商人', emoji: '🧳', before: '北の 王都で 仕入れて 来たんだが……王都も 妙な 空気だ', after: '王都の 騎士団が 東に 調査に 来てるらしい。兄を 探してる 女の子の 騎士が いたな' },
      { name: '湖守のおばあさん', emoji: '👵', before: 'この湖は 雨が 降った分だけ 水かさが 増える。それが 今は……', after: '水位計が 雨の 分だけ、きっちり 動いておる' },
    ],
    afterClearScript: { scriptId: 'C4-10', flag: 'g1c4_town_done' },
    springName: '修練の泉',
  },
  camp5: {
    id: 'camp5', name: '発掘隊のキャンプ', bg: 'bg_ruins_camp', chapterId: 'g1c5',
    shop: { tools: ['potion', 'hi_potion', 'hint_feather', 'time_sand'], gear: ['silver_sword', 'mirror_shield'] },
    villagers: [
      { name: '測量係', emoji: '📐', before: '直角が 89° に なったり 91° に なったり。図面が 引けない', after: '直角が 90°。あたりまえが 戻った。図面、引き直しだ' },
      { name: '料理番', emoji: '🍲', before: '丸い 鍋が 楕円に なって、ふたが 閉まらない', after: '鍋が 丸に 戻った! 今夜は シチューだ' },
      { name: '若い学者', emoji: '🧑‍🎓', before: '壁画の 三角形、辺の 長さを 測ったら 3、4、5 でした。何か 意味が ある気が', after: '3、4、5……正方形の 面積は 9、16、25。……あれ? 9+16 は……いや、偶然ですよね' },
      { name: '王都から来た使い', emoji: '✉️', before: '学院から 手紙を 預かってきた。王都では 騎士団が 東へ 調査に 出ているそうだ', after: '隊長の 報告が 王都に 届く。君の 名前も 一緒にな' },
      { name: '発掘隊の隊長', emoji: '🎩', before: '歪みで 遺跡の 角度と 長さが 狂った。奥の 碑まで 行けない', after: '遺跡が 元に 戻った! 直角が 直角に、円が 円に' },
    ],
    afterClearScript: { scriptId: 'C5-10', flag: 'g1c5_camp_done' },
    springName: '修練の泉',
  },
  village6: {
    id: 'village6', name: '石切り場の村', bg: 'bg_mountain_village', chapterId: 'g1c6',
    shop: { tools: ['potion', 'hi_potion', 'hint_feather', 'time_sand'], gear: ['silver_sword', 'miner_helmet'] },
    villagers: [
      { name: '荷車ひき', emoji: '🛒', before: '同じ 石なのに 片方が 倍 重い。荷車の 車軸が 3本 折れた', after: '重さが そろった。車軸も 折れねえ' },
      { name: '石工の女性', emoji: '👩‍🏭', before: '円柱の 井戸を 切り出したら、中が 四角かった。展開図が 狂ってる', after: '円柱は 円柱に 戻った。側面を 開くと ちゃんと 長方形' },
      { name: '見習いの少年', emoji: '👦', before: '立体王って 何面 あるんだろ。100面くらい?', after: '立体王の 冠、正二十面体だって。20面! 数えたい!' },
      { name: '北から来た旅人', emoji: '🧳', before: '北の 塔の 近くから 逃げてきた。あの 塔の まわりは、もう 形が ない', after: '塔が 見えたのか。……あの 塔に 近づくなら、ちゃんと 準備して 行けよ' },
      { name: '石工の親方', emoji: '🧔‍♂️', before: '切り出した 石の 重さが 合わねえ。同じ 大きさに 切ったのに、片方が 倍 重い', after: '石の 重さが 合うように なった! あたりまえが 一番 ありがてえ' },
    ],
    afterClearScript: { scriptId: 'C6-11', flag: 'g1c6_village_done' },
    springName: '修練の泉',
  },
  inn7: {
    id: 'inn7', name: '塔守の宿', bg: 'bg_tower_inn', chapterId: 'g1c7',
    shop: { tools: ['potion', 'hi_potion', 'hint_feather', 'time_sand'], gear: ['silver_sword', 'recorder_pen'] },
    villagers: [
      { name: '記録係', emoji: '🧑‍💼', before: '去年の 雨の量、平均が 3000ミリに なってる。海の 底じゃ あるまいし', after: '平均 1200ミリ。中央値 1150。範囲 400。いつもの プリマだ' },
      { name: '塔守の妻', emoji: '👩', before: '塔守は 塔の ことしか 頭に ない。……でも、あの 塔が 静かになれば', after: '塔守が ぐっすり 眠ってる。三か月ぶりよ' },
      { name: '王国の兵士', emoji: '💂', before: 'レナ様は 見習いだが、剣の 腕は 隊で 一番だ', after: 'レナ様が 王都へ 戻られる。君たちも 一緒だと 聞いた' },
      { name: '北から逃げてきた老人', emoji: '👴', before: '北の 塔の ふもとに 住んでいた。ある 朝、畑の 作物の 数が 分からなくなった', after: '北は まだ 歪んだままだ。……だが、ここが 直ったなら、あそこも 直るのかもしれん' },
      { name: '塔守', emoji: '🧙‍♂️', before: '塔には プリマ 千年分の 記録が ある。だが 今、その 記録が 書き換わっている', after: '記録が 戻った。ありがとう、旅の方' },
    ],
    springName: '修練の泉',
  },
};

export function getTown(id: string): TownDef {
  const t = towns[id];
  if (!t) throw new Error(`拠点が未定義: ${id}`);
  return t;
}
