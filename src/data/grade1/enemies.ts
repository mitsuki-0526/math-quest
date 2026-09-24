/**
 * 1年版の敵データ(台本 C1-12 の敵セリフ表に対応)。敵の種類 = 問題テンプレート(要件 F28)。
 * 数値(hp/attack/exp/gold)は仮。M2 の試遊(T2-10)で config に外出しして調整する。
 */
export interface EnemyDef {
  id: string;
  name: string;
  /** 出題テンプレートID */
  template: string;
  sprite: string;
  hp: number;
  attack: number;
  exp: number;
  gold: number;
  /** ボスかどうか */
  boss?: boolean;
  /**
   * ボスのフェーズ。HP の割合が untilHpRatio 以下になると次のフェーズへ(配列は HP 割合の降順)。
   * 各フェーズで出題するテンプレートと、フェーズ開始時のセリフ。
   */
  phases?: { untilHpRatio: number; templates: string[]; line: string }[];
  lines: {
    appear: string;
    hit: string;
    /** プレイヤー誤答時(敵の攻撃が通ったとき) */
    miss: string;
    defeat: string;
    /** 3連続正解されたとき(ボス向け、任意) */
    streak?: string;
  };
}

export const enemies: Record<string, EnemyDef> = {
  minus_slime: {
    id: 'minus_slime',
    name: 'マイナススライム',
    template: 'g1.sign.addsub',
    sprite: 'enemy_minus_slime',
    hp: 30,
    attack: 6,
    exp: 12,
    gold: 5,
    lines: { appear: 'マイナススライムが ぷるぷると あらわれた!', hit: '「ひえっ」', miss: '「へへ、マイナスだもんね」', defeat: '「露に…もどる…」' },
  },
  plusminus_bat: {
    id: 'plusminus_bat',
    name: 'プラマイコウモリ',
    template: 'g1.sign.muldiv',
    sprite: 'enemy_plusminus_bat',
    hp: 36,
    attack: 7,
    exp: 15,
    gold: 6,
    lines: { appear: 'プラマイコウモリが ふらふらと あらわれた!', hit: '「きゅっ! どっちだっけ!」', miss: '「わかんないなら こっちのもの!」', defeat: '「はっぱに…なった…」' },
  },
  abs_golem: {
    id: 'abs_golem',
    name: 'ゼッタイチ・ゴーレム',
    template: 'g1.sign.abs',
    sprite: 'enemy_abs_golem',
    hp: 48,
    attack: 8,
    exp: 18,
    gold: 8,
    lines: { appear: 'ゼッタイチ・ゴーレムが のっそりと あらわれた!', hit: '「ゼロカラ……トオイ……」', miss: '「キョリ……ワカラヌカ……」', defeat: '「ミチシルベニ……モドル……」' },
  },
  cross_hopper: {
    id: 'cross_hopper',
    name: 'クロスバッタ',
    template: 'g1.sign.mixed',
    sprite: 'enemy_cross_hopper',
    hp: 40,
    attack: 9,
    exp: 20,
    gold: 9,
    lines: { appear: 'クロスバッタが とびはねて あらわれた!', hit: '「じゅんばん まもられた!」', miss: '「じゅんばん! ぐちゃぐちゃ!」', defeat: '「ただの バッタに もどった」' },
  },
  prime_bee: {
    id: 'prime_bee',
    name: '素数バチ',
    template: 'g1.sign.primefactor',
    sprite: 'enemy_prime_bee',
    hp: 44,
    attack: 8,
    exp: 22,
    gold: 12,
    lines: { appear: '素数バチが ブンブンと あらわれた!', hit: '「われた! われた!」', miss: '「われない! われない!」', defeat: '「ハチに もどって とんでいった」' },
  },
  // --- 第2章 名もなき者の平原 ---
  letter_fairy: {
    id: 'letter_fairy',
    name: '文字の妖精エックス',
    template: 'g1.expr.subst',
    sprite: 'enemy_letter_fairy',
    hp: 34,
    attack: 7,
    exp: 16,
    gold: 7,
    lines: { appear: '文字の妖精エックスが ふわりと あらわれた!', hit: '「あっ、わたし その数だった!」', miss: '「わたし、なんの数だっけ……」', defeat: '「思い出した。ありがとう」' },
  },
  collect_goblin: {
    id: 'collect_goblin',
    name: 'まとめ屋ゴブリン',
    template: 'g1.expr.collect',
    sprite: 'enemy_collect_goblin',
    hp: 42,
    attack: 8,
    exp: 20,
    gold: 9,
    lines: { appear: 'まとめ屋ゴブリンが 袋を かかえて あらわれた!', hit: '「まとめられた!」', miss: '「へへっ、ばらばらの まんまだ」', defeat: '「袋を 置いて 逃げていった」' },
  },
  distribute_fox: {
    id: 'distribute_fox',
    name: '分配キツネ',
    template: 'g1.expr.distribute',
    sprite: 'enemy_distribute_fox',
    hp: 46,
    attack: 9,
    exp: 22,
    gold: 10,
    lines: { appear: '分配キツネが しっぽを ふって あらわれた!', hit: '「ぜんぶに かけられた!」', miss: '「ひとつだけ かけて にげろー」', defeat: '「ただの キツネに もどった」' },
  },
  model_sheep: {
    id: 'model_sheep',
    name: '表しヒツジ',
    template: 'g1.expr.model',
    sprite: 'enemy_model_sheep',
    hp: 40,
    attack: 8,
    exp: 20,
    gold: 9,
    lines: { appear: '表しヒツジが めえめえと あらわれた!', hit: '「めっ! 式に された!」', miss: '「めえ〜、ことばのまま〜」', defeat: '「羊に もどって 草を 食べはじめた」' },
  },
  pattern_centipede: {
    id: 'pattern_centipede',
    name: '規則ムカデ',
    template: 'g1.expr.pattern',
    sprite: 'enemy_pattern_centipede',
    hp: 50,
    attack: 9,
    exp: 26,
    gold: 14,
    lines: { appear: '規則ムカデが ぞろぞろと あらわれた!', hit: '「n段目 よまれた!」', miss: '「かぞえきれまい!」', defeat: '「ムカデに もどった(足は かぞえない)」' },
  },
  masked_scribe: {
    id: 'masked_scribe',
    name: '仮面の書記官',
    template: 'g1.expr.subst',
    sprite: 'enemy_masked_scribe',
    hp: 260,
    attack: 11,
    exp: 150,
    gold: 100,
    boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.expr.subst'], line: '仮面の書記官「x は x。数ではない。……ならば x に 数を入れて 答えられるか?」' },
      { untilHpRatio: 0.66, templates: ['g1.expr.collect', 'g1.expr.distribute'], line: '仮面の書記官「ほう。では 文字のまま 計算してみせよ。数でないものを 足せるものか」' },
      { untilHpRatio: 0.33, templates: ['g1.expr.model', 'g1.expr.pattern'], line: '仮面の書記官「……最後だ。この文を、式にしてみせよ。名前のない世界では、それは できぬはずだ」' },
    ],
    lines: {
      appear: '仮面の書記官が 羽根ペンを かまえた!',
      hit: '「……くっ」',
      miss: '「……ほらな。名前など、なくても同じだ」',
      defeat: '「名前が……戻って……私の名は……」',
      streak: '仮面の書記官「なぜだ。文字は 数ではないのに、なぜ 答えが 出る」',
    },
  },

  // --- 第3章 未知の洞窟 ---
  balance_slime: {
    id: 'balance_slime',
    name: 'てんびんスライム',
    template: 'g1.eq.basic',
    sprite: 'enemy_balance_slime',
    hp: 38,
    attack: 8,
    exp: 18,
    gold: 8,
    lines: { appear: 'てんびんスライムが ゆらゆらと あらわれた!', hit: '「つ、釣り合った!」', miss: '「ぐらぐら〜、まだ 釣り合ってないよ〜」', defeat: '「皿を 置いて 露に もどった」' },
  },
  transpose_mouse: {
    id: 'transpose_mouse',
    name: '移項ネズミ',
    template: 'g1.eq.linear',
    sprite: 'enemy_transpose_mouse',
    hp: 46,
    attack: 9,
    exp: 24,
    gold: 11,
    lines: { appear: '移項ネズミが 数字を くわえて あらわれた!', hit: '「チュッ! 符号 変えられた!」', miss: '「そのまま 運んじゃえ〜」', defeat: '「数字を 落として 走っていった」' },
  },
  paren_troll: {
    id: 'paren_troll',
    name: 'かっこトロル',
    template: 'g1.eq.paren',
    sprite: 'enemy_paren_troll',
    hp: 58,
    attack: 10,
    exp: 28,
    gold: 13,
    lines: { appear: 'かっこトロルが 大きな かっこを ふり上げた!', hit: '「かっこ はずされた!」', miss: '「かっこの中は 見せんぞ〜」', defeat: '「かっこを 落として 石に もどった」' },
  },
  fraction_ghost: {
    id: 'fraction_ghost',
    name: '分数ゴースト',
    template: 'g1.eq.fraction',
    sprite: 'enemy_fraction_ghost',
    hp: 54,
    attack: 10,
    exp: 30,
    gold: 16,
    lines: { appear: '分数ゴーストが ふわふわと あらわれた!', hit: '「分母 はらわれた〜!」', miss: '「ぶんすう〜 ややこしいでしょ〜」', defeat: '「泉の しぶきに もどった」' },
  },
  ratio_crab: {
    id: 'ratio_crab',
    name: '比のカニ',
    template: 'g1.eq.ratio',
    sprite: 'enemy_ratio_crab',
    hp: 44,
    attack: 9,
    exp: 22,
    gold: 11,
    lines: { appear: '比のカニが はさみを 鳴らして あらわれた!', hit: '「内と外 かけられた!」', miss: '「板の 長さ ばらばら〜」', defeat: '「カニに もどって 横歩きで 去った」' },
  },
  shadow_x: {
    id: 'shadow_x',
    name: '未知なる影 X',
    template: 'g1.eq.linear',
    sprite: 'enemy_shadow_x',
    hp: 300,
    attack: 12,
    exp: 190,
    gold: 130,
    boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.eq.basic', 'g1.eq.linear'], line: '未知なる影 X「余は 何者でも ない。x + 7 = 3? 答えなど あるものか」' },
      { untilHpRatio: 0.66, templates: ['g1.eq.paren', 'g1.eq.fraction'], line: '未知なる影 X「ぐ……形が……。ならば かっこと 分数で 隠れよう。余の 正体は 見えぬ!」' },
      { untilHpRatio: 0.33, templates: ['g1.eq.word'], line: '未知なる影 X「……最後だ。余は 言葉の中に 隠れる。式に できるものなら してみよ!」' },
    ],
    lines: {
      appear: '未知なる影 X が 道具の山の上で ふくらんだ!',
      hit: '「……形が……」',
      miss: '「ふふ……余は まだ x のままだ」',
      defeat: '「……にゃ」',
      streak: '未知なる影 X「や、やめろ……形が……余の 形が、決まっていく……」',
    },
  },

  // --- 第4章 水車の湖 ---
  prop_master: {
    id: 'prop_master', name: '比例のヌシ', template: 'g1.func.prop', sprite: 'enemy_prop_master',
    hp: 60, attack: 11, exp: 32, gold: 15,
    lines: { appear: '比例のヌシが 水面から 顔を出した!', hit: '「ぬおっ、2倍が 見抜かれた」', miss: '「ふふ、y は もっと 大きいぞ……」', defeat: '「ただの 大きな魚に もどって 沈んでいった」' },
  },
  invprop_strider: {
    id: 'invprop_strider', name: '反比例のアメンボ', template: 'g1.func.invprop', sprite: 'enemy_invprop_strider',
    hp: 56, attack: 11, exp: 32, gold: 15,
    lines: { appear: '反比例のアメンボが 水面を すべって あらわれた!', hit: '「ぴっ! かけて 同じ数だ!」', miss: '「増えれば 増える……って 思ったでしょ〜」', defeat: '「アメンボに もどって すーっと 消えた」' },
  },
  coord_jelly: {
    id: 'coord_jelly', name: '座標クラゲ', template: 'g1.func.coord', sprite: 'enemy_coord_jelly',
    hp: 52, attack: 10, exp: 30, gold: 14,
    lines: { appear: '座標クラゲが ふわふわと あらわれた!', hit: '「よ、横が 先だった!」', miss: '「縦と 横、逆じゃない〜?」', defeat: '「クラゲに もどって ふわふわ 沈んだ」' },
  },
  graph_eel: {
    id: 'graph_eel', name: 'グラフウナギ', template: 'g1.func.graph', sprite: 'enemy_graph_eel',
    hp: 62, attack: 12, exp: 36, gold: 18,
    lines: { appear: 'グラフウナギが 線を 描いて あらわれた!', hit: '「線を 読まれた!」', miss: '「この線、どっちの きまり〜?」', defeat: '「ウナギに もどって 泳いでいった」' },
  },
  twin_dragons: {
    id: 'twin_dragons', name: '湖の双子竜', template: 'g1.func.prop', sprite: 'enemy_twin_dragons',
    hp: 340, attack: 13, exp: 220, gold: 150, boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.func.prop'], line: 'ナラビ「まずは 我からだ。増えれば 増える! それが 湖の きまりだ!」' },
      { untilHpRatio: 0.66, templates: ['g1.func.invprop'], line: 'サカサ「次は 我だ。増えれば 減る! それが 水車の きまりだ!」' },
      { untilHpRatio: 0.33, templates: ['g1.func.graph', 'g1.func.coord'], line: 'ナラビ・サカサ「ならば 二人 いっしょに! この 線を 読んでみよ!」' },
    ],
    lines: { appear: '青き竜 ナラビと 緑の竜 サカサが にらみ合っている!', hit: '「ぐっ……」', miss: '「ほら、きまりは ひとつだ!」', defeat: '「……どちらも、正しかったのか」', streak: 'ナラビ「……我の 問いにも」 サカサ「……我の 問いにも 答えている、だと?」' },
  },

  // --- 第5章 円の遺跡 ---
  angle_gargoyle: {
    id: 'angle_gargoyle', name: '角度ガーゴイル', template: 'g1.geo.angle', sprite: 'enemy_angle_gargoyle',
    hp: 66, attack: 12, exp: 36, gold: 17,
    lines: { appear: '角度ガーゴイルが 翼を 広げた!', hit: '「ぐっ、角を 読まれた」', miss: '「この角、何度に 見える〜?」', defeat: '「石像に もどって 門の上に 座った」' },
  },
  mirror_spirit: {
    id: 'mirror_spirit', name: '対称ミラー', template: 'g1.geo.symmetry', sprite: 'enemy_mirror_spirit',
    hp: 60, attack: 12, exp: 34, gold: 16,
    lines: { appear: '対称ミラーが 鏡の中から あらわれた!', hit: '「うつしが 見破られた!」', miss: '「線対称? 点対称? どっちかな〜」', defeat: '「ただの 鏡に もどった」' },
  },
  sector_guard: {
    id: 'sector_guard', name: 'おうぎ形の門番', template: 'g1.geo.sector', sprite: 'enemy_sector_guard',
    hp: 74, attack: 13, exp: 42, gold: 20,
    lines: { appear: 'おうぎ形の門番が 盾を かまえた!', hit: '「弧を 測られた!」', miss: '「360 を 忘れてないか〜?」', defeat: '「石の 盾を 置いて 石像に もどった」' },
  },
  construct_ghost: {
    id: 'construct_ghost', name: '作図ゴースト', template: 'g1.geo.construct', sprite: 'enemy_construct_ghost',
    hp: 64, attack: 12, exp: 38, gold: 22,
    lines: { appear: '作図ゴーストが 線を ゆがめて あらわれた!', hit: '「線が まっすぐに!」', miss: '「その線、なんの 線〜?」', defeat: '「祭壇の 影に もどった」' },
  },
  ring_guardian: {
    id: 'ring_guardian', name: '円環の番人', template: 'g1.geo.angle', sprite: 'enemy_ring_guardian',
    hp: 380, attack: 14, exp: 250, gold: 170, boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.geo.angle'], line: '円環の番人「まず 角を 正せ。我の 輪の 中心の 角、いくつに 見える」' },
      { untilHpRatio: 0.66, templates: ['g1.geo.sector'], line: '円環の番人「次は 弧だ。我の 輪の 一部、その 長さと 広さを 測れ」' },
      { untilHpRatio: 0.33, templates: ['g1.geo.move', 'g1.geo.symmetry'], line: '円環の番人「最後だ。形を 動かし、円と 線の きまりを 述べよ」' },
    ],
    lines: { appear: '円環の番人が 輪を きしませて 立ちふさがった!', hit: '「……輪が……」', miss: '「……輪は、まだ ゆがんだままだ」', defeat: '「……円に、戻った」', streak: '円環の番人「輪が……円に 近づいている……」' },
  },

  // --- 第6章 立体の山 ---
  prism_golem: {
    id: 'prism_golem', name: '角柱ゴーレム', template: 'g1.solid.prism', sprite: 'enemy_prism_golem',
    hp: 80, attack: 13, exp: 44, gold: 20,
    lines: { appear: '角柱ゴーレムが 岩を きしませて 立ち上がった!', hit: '「タイセキ……ミヌカレタ……」', miss: '「ソコメン……ワスレタナ……」', defeat: '「ただの 四角い 岩に もどった」' },
  },
  cone_bat: {
    id: 'cone_bat', name: '円錐コウモリ', template: 'g1.solid.pyramid', sprite: 'enemy_cone_bat',
    hp: 72, attack: 13, exp: 44, gold: 20,
    lines: { appear: '円錐コウモリが とがった 翼で あらわれた!', hit: '「きゅっ! 3分の1 された!」', miss: '「柱と 同じって 思ったでしょ〜」', defeat: '「とがった 石に もどって 落ちた」' },
  },
  sphere_spirit: {
    id: 'sphere_spirit', name: '球のスピリット', template: 'g1.solid.sphere', sprite: 'enemy_sphere_spirit',
    hp: 78, attack: 13, exp: 48, gold: 26,
    lines: { appear: '球のスピリットが ふわりと 浮いた!', hit: '「まん丸が……読まれた……」', miss: '「3乗? 2乗? どっち〜?」', defeat: '「丸い 石に もどって 転がった」' },
  },
  face_turtle: {
    id: 'face_turtle', name: '面のカメ', template: 'g1.solid.surface', sprite: 'enemy_face_turtle',
    hp: 84, attack: 13, exp: 46, gold: 21,
    lines: { appear: '面のカメが 甲羅を 開いて あらわれた!', hit: '「ぜんぶの 面 数えられた!」', miss: '「底面、1つ 忘れてな〜い?」', defeat: '「カメに もどって 甲羅に 引っこんだ」' },
  },
  projection_eagle: {
    id: 'projection_eagle', name: '投影図ワシ', template: 'g1.solid.projection', sprite: 'enemy_projection_eagle',
    hp: 76, attack: 13, exp: 44, gold: 21,
    lines: { appear: '投影図ワシが 影を 落として あらわれた!', hit: '「形を 見抜かれた!」', miss: '「上から? 横から? どっちの 影〜?」', defeat: '「ワシに もどって 飛び去った」' },
  },
  relation_spider: {
    id: 'relation_spider', name: '位置関係クモ', template: 'g1.solid.relation', sprite: 'enemy_relation_spider',
    hp: 70, attack: 13, exp: 42, gold: 20,
    lines: { appear: '位置関係クモが 糸を 張って あらわれた!', hit: '「ねじれ、見破られた!」', miss: '「平行? 垂直? 交わらない〜?」', defeat: '「クモに もどって 糸を たたんだ」' },
  },
  king_poly: {
    id: 'king_poly', name: '立体王ポリ', template: 'g1.solid.prism', sprite: 'enemy_king_poly',
    hp: 420, attack: 15, exp: 280, gold: 190, boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.solid.prism', 'g1.solid.pyramid'], line: '立体王ポリ「まず 余の 体の 体積を 述べよ。柱と 錐、区別できるか」' },
      { untilHpRatio: 0.66, templates: ['g1.solid.surface', 'g1.solid.sphere'], line: '立体王ポリ「次は 表面だ。見えぬ 面まで 数えられるか」' },
      { untilHpRatio: 0.33, templates: ['g1.solid.projection', 'g1.solid.relation'], line: '立体王ポリ「最後だ。余の 影を 見て、余の 形を 当てよ」' },
    ],
    lines: { appear: '立体王ポリが 多面体の 体を 鳴らした!', hit: '「……面が……」', miss: '「……余の 面は、まだ 足りぬ」', defeat: '「……見えぬ 面まで、数えられた」', streak: '立体王ポリ「面が……戻ってくる。余の 体が、重さを 取り戻していく……」' },
  },

  // --- 第7章 記録の塔 ---
  mean_ghost: {
    id: 'mean_ghost', name: '平均ゴースト', template: 'g1.data.mean', sprite: 'enemy_mean_ghost',
    hp: 88, attack: 14, exp: 50, gold: 24,
    lines: { appear: '平均ゴーストが 巻物を まきちらして あらわれた!', hit: '「合計、割られた〜!」', miss: '「個数で 割った〜? ほんとに〜?」', defeat: '「巻物に もどって 棚に 収まった」' },
  },
  freq_bat: {
    id: 'freq_bat', name: '度数コウモリ', template: 'g1.data.freq', sprite: 'enemy_freq_bat',
    hp: 84, attack: 14, exp: 50, gold: 24,
    lines: { appear: '度数コウモリが 表を ひっくり返して あらわれた!', hit: '「きゅっ! 相対度数 出された!」', miss: '「足して 1 に なる〜? なるかな〜?」', defeat: '「表の 数字に もどった」' },
  },
  median_librarian: {
    id: 'median_librarian', name: '中央値の司書', template: 'g1.data.median', sprite: 'enemy_median_librarian',
    hp: 90, attack: 14, exp: 52, gold: 25,
    lines: { appear: '中央値の司書が 眼鏡を 光らせた!', hit: '「並べ替え……されました……」', miss: '「並べ替えを、お忘れでは?」', defeat: '「眼鏡を 置いて 影に もどった」' },
  },
  approx_owl: {
    id: 'approx_owl', name: '近似値フクロウ', template: 'g1.data.approx', sprite: 'enemy_approx_owl',
    hp: 86, attack: 14, exp: 56, gold: 30,
    lines: { appear: '近似値フクロウが 首を かしげた!', hit: '「ホゥ! 誤差、見抜かれた」', miss: '「その値、真の値かな〜?」', defeat: '「普通の フクロウに もどって 北へ 飛んだ」' },
  },
  apostle: {
    id: 'apostle', name: '歪みの使徒', template: 'g1.data.mean', sprite: 'enemy_apostle',
    hp: 520, attack: 16, exp: 400, gold: 300, boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.data.mean', 'g1.data.median'], line: '歪みの使徒「まず この 塔の 理を。代表値を 述べよ」' },
      { untilHpRatio: 0.75, templates: ['g1.data.freq', 'g1.data.approx'], line: '歪みの使徒「柱の 形を 読め。数の 群れを、一つの 数に 押しこめずに」' },
      { untilHpRatio: 0.5, templates: ['g1.sign.mixed', 'g1.expr.collect', 'g1.eq.linear', 'g1.func.prop', 'g1.geo.sector', 'g1.solid.prism'], line: '歪みの使徒「では 六つの 碑の 理を。符号、文字、等式、比例、形、体積……忘れては おるまいな」' },
      { untilHpRatio: 0.25, templates: ['g1.sign.mixed', 'g1.eq.paren'], line: '歪みの使徒「……最後だ。数の 根、四則と 等式。これを 示せば、我は 認めよう」' },
    ],
    lines: { appear: '歪みの使徒が 碑の上で 立ち上がった。数字が 渦を巻く!', hit: '「……」', miss: '「……ほどける。数が、意味から」', defeat: '「……碑守の 理、すべて 言い直された」', streak: '歪みの使徒「……なぜ 迷わぬ。比べる 数を、なぜ 恐れぬ」' },
  },

  king_nega: {
    id: 'king_nega',
    name: '符号王ネガ',
    template: 'g1.sign.addsub',
    sprite: 'enemy_king_nega',
    hp: 320, // 試遊前の調整: 240 では 6〜8 問で倒れ、ボスとして短かった(Lv5〜6 で 10 問前後に)
    attack: 10,
    exp: 120,
    gold: 80,
    boss: true,
    phases: [
      { untilHpRatio: 1, templates: ['g1.sign.addsub'], line: '符号王ネガ「まずは 足し引きからなのだ。マイナスはいつだって マイナス!」' },
      { untilHpRatio: 0.66, templates: ['g1.sign.muldiv'], line: '符号王ネガ「ぐぬ…。ならば かけ算だ! マイナスとマイナスを かけたとて、マイナスなのだ!」' },
      { untilHpRatio: 0.33, templates: ['g1.sign.numberline', 'g1.sign.mixed'], line: '符号王ネガ「余の目盛りを 読めるものなら 読んでみよ! 数直線ごと 飲みこんでやるのだ!」' },
    ],
    lines: {
      appear: '符号王ネガが 碑の上から 見おろしている!',
      hit: '「ぐぬっ」',
      miss: '「ほれ見よ! マイナスは マイナスなのだ!」',
      defeat: '「……マイナスと マイナスを かけると……戻る、のか……」',
      streak: '符号王ネガ「な、なぜ 当たる…。碑には そう刻んで……」',
    },
  },
};

export function getEnemy(id: string): EnemyDef {
  const e = enemies[id];
  if (!e) throw new Error(`敵が未定義: ${id}`);
  return e;
}
