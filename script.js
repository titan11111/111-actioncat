// ============================================================
//  定数・初期化
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 400;
const GROUND_Y = canvas.height - 60;
const STAGE_LENGTH = 5000;
// 猫の表示サイズ（80%）。足元を敵と同じGROUND_Yに揃えるため下基準で描画する
const CAT_DRAW_W = 65;   // 78 * 0.8 * 1.05 (5%拡大)
const CAT_DRAW_H = 65;

// ============================================================
//  主人公ネコ：スプライトシート（4x4固定グリッド）
//  row0: 立ち/座り/伏せ/くつろぎ
//  row1: 歩行
//  row2: 走行（ジャンプ時の見た目として流用）
// ============================================================
const CAT_SHEET = {
  src: 'Remove_background_from_this_sprite_sheet_image_ma-1773478477318.png',
  cols: 4,
  rows: 4,
  runOffsetX: -10,
  runExtendLeft: 3,
};
let catSheetImg = null;
let catSheetLoaded = false;

function loadCatSheet() {
  catSheetImg = new Image();
  catSheetImg.crossOrigin = 'anonymous';
  catSheetImg.onload = () => { catSheetLoaded = true; };
  catSheetImg.src = CAT_SHEET.src;
}
loadCatSheet();

// ボス・サンダーウルフのアニメーション（フレーム番号と切替までのティック数）
const BOSS_ANIM = {
  idle:   { frames: [0],              interval: 22 },
  prowl:  { frames: [0, 1, 1, 0],    interval: 14 },
  rage:   { frames: [1, 2, 3, 3, 2], interval: 10 },
  charge: { frames: [2, 3],          interval: 8 },
};

// ============================================================
//  高精細ピクセルアート生成システム (32x32グリッド)
// ============================================================
function createPixelCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext('2d') };
}

function drawPixels(tCtx, pixels, scale) {
  pixels.forEach(([x, y, color]) => {
    tCtx.fillStyle = color;
    tCtx.fillRect(x * scale, y * scale, scale, scale);
  });
}

// --- 猫スプライト (32x32, 2フレーム) ---
function generateCatFrames() {
  const frames = [];
  const S = 1; // 1px per pixel in 32x32 canvas
  const body = '#f39c12', bodyDark = '#e67e22', bodyLight = '#f5b041';
  const eye = '#2c3e50', nose = '#e74c3c', inner = '#fadbd8', white = '#fff';

  // 共通パーツ
  const headBody = [
    // 耳 (三角)
    [9,2,body],[10,1,body],[11,1,body],[12,2,body],
    [19,2,body],[20,1,body],[21,1,body],[22,2,body],
    [10,2,body],[11,2,body],[20,2,body],[21,2,body],
    [10,3,inner],[11,3,inner],[20,3,inner],[21,3,inner],
    // 頭
    ...[...Array(14)].flatMap((_,i) => [[9+i,4,body],[9+i,5,body],[9+i,6,body],[9+i,7,body]]),
    ...[...Array(12)].flatMap((_,i) => [[10+i,8,body]]),
    // 目
    [12,5,white],[13,5,white],[12,6,eye],[13,6,eye],
    [18,5,white],[19,5,white],[18,6,eye],[19,6,eye],
    // 鼻・口
    [15,7,nose],[16,7,nose],
    // 胴体
    ...[...Array(14)].flatMap((_,i) => [[9+i,9,body],[9+i,10,body],[9+i,11,body],[9+i,12,body],[9+i,13,body],[9+i,14,body],[9+i,15,body]]),
    ...[...Array(12)].flatMap((_,i) => [[10+i,16,body],[10+i,17,body]]),
    // お腹
    ...[...Array(8)].flatMap((_,i) => [[12+i,12,bodyLight],[12+i,13,bodyLight],[12+i,14,bodyLight]]),
    // 縞模様
    [10,10,bodyDark],[11,10,bodyDark],[14,10,bodyDark],[15,10,bodyDark],[18,10,bodyDark],[19,10,bodyDark],[21,10,bodyDark],[22,10,bodyDark],
    [10,14,bodyDark],[11,14,bodyDark],[20,14,bodyDark],[21,14,bodyDark],
  ];

  // Frame 0: 立ちポーズ
  const f0 = createPixelCanvas(32, 32);
  drawPixels(f0.ctx, headBody, S);
  // 足 (立ち)
  const legs0 = [
    [10,18,body],[11,18,body],[10,19,body],[11,19,body],[10,20,body],[11,20,body],[10,21,bodyDark],[11,21,bodyDark],
    [20,18,body],[21,18,body],[20,19,body],[21,19,body],[20,20,body],[21,20,body],[20,21,bodyDark],[21,21,bodyDark],
  ];
  drawPixels(f0.ctx, legs0, S);
  // 尻尾 (上向き)
  const tail0 = [[23,9,bodyDark],[24,8,bodyDark],[25,7,bodyDark],[26,6,bodyDark],[26,5,bodyDark],[27,5,bodyDark]];
  drawPixels(f0.ctx, tail0, S);
  frames.push(f0.canvas);

  // Frame 1: 歩きポーズ
  const f1 = createPixelCanvas(32, 32);
  drawPixels(f1.ctx, headBody, S);
  const legs1 = [
    [9,18,body],[10,18,body],[9,19,body],[10,19,body],[8,20,body],[9,20,body],[8,21,bodyDark],[9,21,bodyDark],
    [21,18,body],[22,18,body],[21,19,body],[22,19,body],[22,20,body],[23,20,body],[22,21,bodyDark],[23,21,bodyDark],
  ];
  drawPixels(f1.ctx, legs1, S);
  const tail1 = [[23,10,bodyDark],[24,9,bodyDark],[25,9,bodyDark],[26,10,bodyDark],[27,10,bodyDark]];
  drawPixels(f1.ctx, tail1, S);
  frames.push(f1.canvas);

  return frames;
}

// --- 犬スプライト (32x32, 2フレーム) ---
function generateDogFrames() {
  const frames = [];
  const S = 1;
  const body = '#a0522d', bodyDark = '#8b4513', bodyLight = '#cd853f', eye = '#000', nose = '#1a1a1a', tongue='#e74c3c';

  const base = [
    // 頭
    ...[...Array(10)].flatMap((_,i) => [[1+i,4,body],[1+i,5,body],[1+i,6,body],[1+i,7,body],[1+i,8,body]]),
    // 耳（垂れ耳）
    [1,3,bodyDark],[2,3,bodyDark],[1,4,bodyDark],[2,4,bodyDark],[1,5,bodyDark],
    // 目
    [4,5,eye],[5,5,eye],
    // 鼻
    [8,6,nose],[9,6,nose],[8,7,nose],
    // 舌
    [9,7,tongue],[10,7,tongue],
    // 胴体
    ...[...Array(16)].flatMap((_,i) => [[5+i,9,body],[5+i,10,body],[5+i,11,body],[5+i,12,body],[5+i,13,body],[5+i,14,body],[5+i,15,body]]),
    ...[...Array(14)].flatMap((_,i) => [[6+i,16,body]]),
    // 腹
    ...[...Array(10)].flatMap((_,i) => [[8+i,13,bodyLight],[8+i,14,bodyLight]]),
    // 尻尾
    [21,8,bodyDark],[22,7,bodyDark],[23,6,bodyDark],[23,5,bodyDark],
  ];

  // Frame 0
  const f0 = createPixelCanvas(32, 32);
  drawPixels(f0.ctx, base, S);
  drawPixels(f0.ctx, [
    [6,17,body],[7,17,body],[6,18,body],[7,18,body],[6,19,body],[7,19,body],[6,20,bodyDark],[7,20,bodyDark],
    [17,17,body],[18,17,body],[17,18,body],[18,18,body],[17,19,body],[18,19,body],[17,20,bodyDark],[18,20,bodyDark],
  ], S);
  frames.push(f0.canvas);

  // Frame 1
  const f1 = createPixelCanvas(32, 32);
  drawPixels(f1.ctx, base, S);
  drawPixels(f1.ctx, [
    [5,17,body],[6,17,body],[4,18,body],[5,18,body],[4,19,body],[5,19,body],[4,20,bodyDark],[5,20,bodyDark],
    [18,17,body],[19,17,body],[19,18,body],[20,18,body],[19,19,body],[20,19,body],[19,20,bodyDark],[20,20,bodyDark],
  ], S);
  frames.push(f1.canvas);

  return frames;
}

// --- 子供スプライト (32x32, 2フレーム) ---
function generateKidFrames() {
  const frames = [];
  const S = 1;
  const hair = '#f1c40f', skin = '#fdd9b5', shirt = '#3498db', shirtDark = '#2980b9';
  const pants = '#2c3e50', shoe = '#1a1a1a', eye = '#000', mouth = '#c0392b';

  const base = [
    // 髪
    ...[...Array(8)].flatMap((_,i) => [[12+i,2,hair],[12+i,3,hair]]),
    [12,4,hair],[19,4,hair],
    // 顔
    ...[...Array(6)].flatMap((_,i) => [[13+i,4,skin],[13+i,5,skin],[13+i,6,skin],[13+i,7,skin]]),
    // 目
    [14,5,eye],[17,5,eye],
    // 口
    [15,7,mouth],[16,7,mouth],
    // 服
    ...[...Array(10)].flatMap((_,i) => [[11+i,8,shirt],[11+i,9,shirt],[11+i,10,shirt],[11+i,11,shirt],[11+i,12,shirt]]),
    ...[...Array(8)].flatMap((_,i) => [[12+i,13,shirt]]),
    // 襟
    [15,8,shirtDark],[16,8,shirtDark],
    // ズボン
    ...[...Array(8)].flatMap((_,i) => [[12+i,14,pants],[12+i,15,pants]]),
  ];

  const f0 = createPixelCanvas(32, 32);
  drawPixels(f0.ctx, base, S);
  drawPixels(f0.ctx, [
    [13,16,pants],[14,16,pants],[13,17,pants],[14,17,pants],[13,18,pants],[14,18,pants],[13,19,shoe],[14,19,shoe],
    [17,16,pants],[18,16,pants],[17,17,pants],[18,17,pants],[17,18,pants],[18,18,pants],[17,19,shoe],[18,19,shoe],
  ], S);
  frames.push(f0.canvas);

  const f1 = createPixelCanvas(32, 32);
  drawPixels(f1.ctx, base, S);
  drawPixels(f1.ctx, [
    [12,16,pants],[13,16,pants],[11,17,pants],[12,17,pants],[11,18,pants],[12,18,pants],[11,19,shoe],[12,19,shoe],
    [18,16,pants],[19,16,pants],[19,17,pants],[20,17,pants],[19,18,pants],[20,18,pants],[19,19,shoe],[20,19,shoe],
  ], S);
  frames.push(f1.canvas);

  return frames;
}

// --- トラックスプライト (48x32, 2フレームタイヤ回転) ---
function generateTruckFrames() {
  const frames = [];
  const S = 1;
  const cargo = '#bdc3c7', cargoDark = '#95a5a6', cab = '#34495e', window_ = '#74b9ff';
  const wheel = '#1a1a1a', hub = '#7f8c8d', bumper = '#e74c3c';

  const base = [
    // 荷台
    ...[...Array(24)].flatMap((_,i) => [[2+i,4,cargo],[2+i,5,cargo],[2+i,6,cargo],[2+i,7,cargo],[2+i,8,cargo],[2+i,9,cargo],[2+i,10,cargo],[2+i,11,cargo],[2+i,12,cargo],[2+i,13,cargo]]),
    ...[...Array(24)].map((_,i) => [2+i,4,cargoDark]),
    ...[...Array(24)].map((_,i) => [2+i,5,cargoDark]),
    // 運転席
    ...[...Array(12)].flatMap((_,i) => [[26+i,6,cab],[26+i,7,cab],[26+i,8,cab],[26+i,9,cab],[26+i,10,cab],[26+i,11,cab],[26+i,12,cab],[26+i,13,cab]]),
    // フロント窓
    ...[...Array(6)].flatMap((_,i) => [[28+i,7,window_],[28+i,8,window_],[28+i,9,window_]]),
    // バンパー
    [37,12,bumper],[37,13,bumper],[38,12,bumper],[38,13,bumper],
    // 車体底
    ...[...Array(38)].map((_,i) => [1+i,14,cab]),
  ];

  // タイヤパターン2種
  const tireBase = (cx, cy) => {
    const p = [];
    for(let dy=-3;dy<=3;dy++) for(let dx=-3;dx<=3;dx++) {
      if(dx*dx+dy*dy<=9) p.push([cx+dx,cy+dy,wheel]);
    }
    return p;
  };

  const hubPattern0 = (cx,cy) => [[cx,cy,hub],[cx-1,cy,hub],[cx+1,cy,hub],[cx,cy-1,hub],[cx,cy+1,hub]];
  const hubPattern1 = (cx,cy) => [[cx,cy,hub],[cx-1,cy-1,hub],[cx+1,cy+1,hub],[cx+1,cy-1,hub],[cx-1,cy+1,hub]];

  const f0 = createPixelCanvas(48, 32);
  drawPixels(f0.ctx, base, S);
  drawPixels(f0.ctx, [...tireBase(8,18),...tireBase(32,18),...hubPattern0(8,18),...hubPattern0(32,18)], S);
  frames.push(f0.canvas);

  const f1 = createPixelCanvas(48, 32);
  drawPixels(f1.ctx, base, S);
  drawPixels(f1.ctx, [...tireBase(8,18),...tireBase(32,18),...hubPattern1(8,18),...hubPattern1(32,18)], S);
  frames.push(f1.canvas);

  return frames;
}

// --- 障害物スプライト群 ---
function generateBoxSprite() {
  const c = createPixelCanvas(32, 32);
  const S = 1;
  const wood = '#cc8e35', woodDark = '#a0722c', band = '#8b4513', nail = '#bdc3c7';
  const pixels = [
    ...[...Array(24)].flatMap((_,i) => [...Array(20)].map((_,j) => [4+i,6+j,wood])),
    ...[...Array(24)].flatMap((_,i) => [[4+i,6,woodDark],[4+i,7,woodDark]]),
    ...[...Array(20)].flatMap((_,j) => [[15,6+j,band],[16,6+j,band]]),
    ...[...Array(24)].flatMap((_,i) => [[4+i,14,band],[4+i,15,band]]),
    [6,10,nail],[25,10,nail],[6,20,nail],[25,20,nail],
  ];
  drawPixels(c.ctx, pixels, S);
  return c.canvas;
}

function generateRockSprite() {
  const c = createPixelCanvas(32, 32);
  const S = 1;
  const rock = '#6c7a89', rockLight = '#95a5a6', rockDark = '#4a5568';
  const pixels = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const x = 10 + i, y = 12 + j;
    if (Math.abs(i - 5.5) + Math.abs(j - 5.5) < 8) pixels.push([x, y, rock]);
  }
  pixels.push([12,14,rockLight],[15,12,rockLight],[18,14,rockLight],[13,18,rockDark],[17,16,rockDark]);
  drawPixels(c.ctx, pixels, S);
  return c.canvas;
}

function generateBushSprite() {
  const c = createPixelCanvas(32, 32);
  const S = 1;
  const leaf = '#27ae60', leafLight = '#2ecc71', leafDark = '#1e8449';
  const pixels = [];
  for (let i = 0; i < 16; i++) for (let j = 0; j < 14; j++) {
    const x = 8 + i, y = 14 + j;
    if ((i - 7) * (i - 7) + (j - 6) * (j - 6) < 60) pixels.push([x, y, leaf]);
  }
  pixels.push([12,16,leafLight],[15,18,leafLight],[14,20,leafLight],[11,18,leafDark],[16,19,leafDark]);
  drawPixels(c.ctx, pixels, S);
  return c.canvas;
}

function generateBarrelSprite() {
  const c = createPixelCanvas(32, 32);
  const S = 1;
  const barrel = '#8b4513', barrelDark = '#654321', band = '#daa520';
  const pixels = [
    ...[...Array(16)].flatMap((_,i) => [...Array(14)].map((_,j) => [8+i,10+j,barrel])),
    ...[...Array(16)].flatMap((_,i) => [[8+i,10,barrelDark],[8+i,11,barrelDark]]),
    ...[...Array(16)].flatMap((_,i) => [[8+i,22,barrelDark],[8+i,23,barrelDark]]),
    ...[...Array(14)].flatMap((_,j) => [[8,10+j,barrelDark],[9,10+j,barrelDark],[22,10+j,barrelDark],[23,10+j,barrelDark]]),
    ...[...Array(12)].flatMap((_,i) => [[10+i,15,band],[10+i,16,band],[10+i,17,band]]),
  ];
  drawPixels(c.ctx, pixels, S);
  return c.canvas;
}

// --- お魚スプライト ---
function generateFishSprite() {
  const c = createPixelCanvas(32, 32);
  const S = 1;
  const body = '#5dade2', bodyLight = '#85c1e9', tail = '#2e86c1', eye_ = '#fff', pupil = '#000', fin = '#3498db';
  const pixels = [
    // 尾
    [4,12,tail],[5,11,tail],[5,13,tail],[4,11,tail],[4,13,tail],[3,10,tail],[3,14,tail],
    // 体
    ...[...Array(14)].flatMap((_,i) => [[6+i,11,body],[6+i,12,body],[6+i,13,body]]),
    ...[...Array(10)].flatMap((_,i) => [[8+i,10,body],[8+i,14,body]]),
    ...[...Array(6)].flatMap((_,i) => [[10+i,9,body],[10+i,15,body]]),
    // 腹
    ...[...Array(8)].flatMap((_,i) => [[8+i,13,bodyLight],[8+i,14,bodyLight]]),
    // ヒレ
    [12,8,fin],[13,8,fin],[12,16,fin],[13,16,fin],
    // 目
    [17,11,eye_],[18,11,eye_],[17,12,pupil],
  ];
  drawPixels(c.ctx, pixels, S);
  return c.canvas;
}

// 主人公ネコ：生成ピクセルアート2コマ（立ち・歩き）のみ使用
const catFrames = generateCatFrames();
const dogFrames = generateDogFrames();
const kidFrames = generateKidFrames();
const truckFrames = generateTruckFrames();
// 障害物スプライト（フォールバック＝生成ピクセルアート、画像ロード後に差し替え）
const obstacleSprites = [
  generateBoxSprite(),
  generateRockSprite(),
  generateBushSprite(),
  generateBarrelSprite(),
];
// 1面・2面向け障害物（石/木の平台・樽・柵・茂み・植木鉢・木箱など）9種
const obstacleImagePaths = [
  'Remove_background_to_create_transparent_PNG-1771127944408.png',  // ダメージ石木平台
  'Remove_background_to_create_transparent_PNG-1771128067808.png',  // 工業平台
  'Remove_background_to_create_transparent_PNG-1771128354402.png',  // 木の樽
  'Remove_background_to_create_transparent_PNG-1771128374624.png',  // 茂み
  'Remove_background_to_create_transparent_PNG-1771128381367.png',  // 木の柵
  'Remove_background_to_create_transparent_PNG-1771128384682.png',  // 石ブロック
  'Remove_background_to_create_transparent_PNG-1771128387595.png',  // 植木鉢
  'Remove_background_to_create_transparent_PNG-1771128557034.png',  // 木の箱
  'Remove_background_to_create_transparent_PNG-1771128561017.png',  // 金属樽風ブロック
];
obstacleImagePaths.forEach((src, i) => {
  const img = new Image();
  img.onload = () => {
    if (i < 4) obstacleSprites[i] = img;
    else obstacleSprites.push(img);
  };
  img.src = src;
});
// ジャンプ台用バネ平台・1面遠景の山・雲・アイテムの魚（1面・2面素材）
let springPlatformImg = null;
let mountainBgImg = null;
let cloudSpriteImg = null;
let fishItemImg = null;
['Remove_background_to_create_transparent_PNG-1771127939271.png',
 'Remove_background_to_create_transparent_PNG-1771128632171.png',
 'Remove_background_to_create_transparent_PNG-1771128634878.png',
 'Remove_background_to_create_transparent_PNG-1771128726026.png'].forEach((src, i) => {
  const img = new Image();
  img.onload = () => {
    if (i === 0) springPlatformImg = img;
    else if (i === 1) mountainBgImg = img;
    else if (i === 2) cloudSpriteImg = img;
    else fishItemImg = img;
  };
  img.src = src;
});
// 動く床用画像
let movingPlatformImg = null;
(function() {
  const img = new Image();
  img.onload = () => { movingPlatformImg = img; };
  img.src = 'Pixel_art_game_asset_moving_platform_for_2D_actio-1771127854899.png';
})();
const fishSprite = generateFishSprite();

// ============================================================
//  ステージ2 キャラクター Canvas パス描画（110-カラスの逆襲 方式）
// ============================================================

// --- カラス敵（w:73, h:73） ---
// 翼角度を sin で変化させ、110 の wingA テーブル方式に倣ったグライド表現
function _drawCrowAtOrigin(ctx, w, h, tick, phase) {
  const s = Math.min(w, h) / 55;
  ctx.save();
  ctx.scale(-s, s); // 左向き（進行方向）
  const wa = Math.sin(tick * 0.22 + phase) * 0.65;

  // 上翼
  ctx.save();
  ctx.rotate(-wa);
  ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, -8); ctx.lineTo(-32, -24 + Math.abs(wa) * 8); ctx.lineTo(-24, -12);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  // 下翼
  ctx.save();
  ctx.rotate(wa * 0.55);
  ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-4, 8); ctx.lineTo(-30, 20 - Math.abs(wa) * 6); ctx.lineTo(-22, 10);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();

  // 胴体
  ctx.fillStyle = '#222'; ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // 頭
  ctx.beginPath(); ctx.ellipse(11, -6, 10, 8, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // くちばし（三角・黄褐色）
  ctx.fillStyle = '#8b6914';
  ctx.beginPath(); ctx.moveTo(19, -7); ctx.lineTo(30, -4); ctx.lineTo(19, -3); ctx.closePath(); ctx.fill();

  // 目（赤 + グロー）
  ctx.fillStyle = 'rgba(220,0,0,0.28)';
  ctx.beginPath(); ctx.arc(15, -8, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cc0000';
  ctx.beginPath(); ctx.arc(15, -8, 3, 0, Math.PI * 2); ctx.fill();

  // 尾羽（わずかに揺れる）
  const tailX = Math.sin(tick * 0.12 + phase) * 2;
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.moveTo(-13, 2); ctx.lineTo(-30 + tailX, 7); ctx.lineTo(-26, 1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-13, 5); ctx.lineTo(-32 + tailX, 13); ctx.lineTo(-28, 6); ctx.closePath(); ctx.fill();

  ctx.restore();
}

// --- 風船敵（w:52, h:73） ---
// 本体がゆっくり左右に揺れ、紐もカーブで追随（110のlerpアナロジー）
function _drawBalloonAtOrigin(ctx, w, h, tick, phase) {
  const s = Math.min(w, h) / 58;
  ctx.save();
  ctx.scale(s, s);
  const sway = Math.sin(tick * 0.055 + phase) * 5;

  // 風船本体
  ctx.fillStyle = '#e74c3c'; ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sway, -20, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // ハイライト（白楕円）
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath(); ctx.ellipse(sway - 7, -30, 8, 5, -0.5, 0, Math.PI * 2); ctx.fill();

  // 結び目（小三角）
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.moveTo(sway - 4, 2); ctx.lineTo(sway + 4, 2); ctx.lineTo(sway, 8); ctx.closePath(); ctx.fill();

  // 紐（曲線。sway に連動して弧が変わる）
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sway, 8);
  ctx.quadraticCurveTo(sway * 0.3, 22, 0, 36);
  ctx.stroke();

  // ゴンドラ（小さい木箱）
  ctx.fillStyle = '#8b6914'; ctx.strokeStyle = '#6b4f0e'; ctx.lineWidth = 1;
  ctx.fillRect(-10, 36, 20, 11); ctx.strokeRect(-10, 36, 20, 11);

  ctx.restore();
}

// --- ハチ敵（w:43, h:52） ---
// 翅を高速振動（110の速い frameInterval に相当）、縞模様の腹部
function _drawBeeAtOrigin(ctx, w, h, tick, phase) {
  const s = Math.min(w, h) / 42;
  ctx.save();
  ctx.scale(s, s);
  const wingV = Math.sin(tick * 0.48 + phase);

  // 左翅（半透明楕円）
  ctx.save();
  ctx.rotate(-0.25 + wingV * 0.28);
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = 'rgba(200,235,255,0.85)'; ctx.strokeStyle = 'rgba(100,160,200,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(-5, -15, 13, 7, -0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  // 右翅
  ctx.save();
  ctx.rotate(0.25 - wingV * 0.28);
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = 'rgba(200,235,255,0.85)'; ctx.strokeStyle = 'rgba(100,160,200,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(5, -15, 13, 7, 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  // 腹部（縞）
  ctx.fillStyle = '#f1c40f'; ctx.strokeStyle = '#d4ac0d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 8, 11, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(20,20,20,0.7)';
    ctx.beginPath(); ctx.ellipse(0, -2 + i * 6, 11, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 胸部
  ctx.fillStyle = '#1a1a1a'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, -7, 9, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // 頭
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(0, -17, 7, 6, 0, 0, Math.PI * 2); ctx.fill();

  // 目（黄色）
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath(); ctx.arc(-3, -19, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -19, 2.5, 0, Math.PI * 2); ctx.fill();

  // 針
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.moveTo(-2, 23); ctx.lineTo(2, 23); ctx.lineTo(0, 31); ctx.closePath(); ctx.fill();

  ctx.restore();
}

// --- ワシボス（w:216, h:192） ---
// 大型、animState に応じて翼速度・怒りグローが変わる（110 の rage 分岐方式）
function _drawEagleAtOrigin(ctx, w, h, tick, animState) {
  const rage = animState === 'rage' || animState === 'charge';
  const wa = Math.sin(tick * (rage ? 0.14 : 0.07)) * (rage ? 0.82 : 0.52);
  const s = Math.min(w, h) / 140;
  ctx.save();
  ctx.scale(s, s);
  ctx.scale(-1, 1); // 嘴を左向きにデフォルト反転

  // 怒り時グロー
  if (rage) {
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(tick * 0.18) * 0.07;
    ctx.fillStyle = '#ff5500';
    ctx.beginPath(); ctx.ellipse(0, 0, 105, 90, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 左翼
  ctx.save();
  ctx.rotate(-wa - 0.22);
  ctx.fillStyle = rage ? '#7a2a00' : '#5a3818'; ctx.strokeStyle = '#2a1008'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -10); ctx.lineTo(-88, -50 + Math.abs(wa) * 18);
  ctx.lineTo(-76, -4); ctx.lineTo(-50, 24); ctx.lineTo(-22, 30);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 1.2;
  [-0.7, -0.45, -0.2].forEach(t => {
    ctx.beginPath();
    ctx.moveTo(-10 + t * 16, -10 + t * 7);
    ctx.lineTo(-88 * (1 + t * 0.22), (-50 + Math.abs(wa) * 18) * (1 + t * 0.18));
    ctx.stroke();
  });
  ctx.restore();

  // 右翼
  ctx.save();
  ctx.rotate(wa + 0.22);
  ctx.fillStyle = rage ? '#7a2a00' : '#5a3818'; ctx.strokeStyle = '#2a1008'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, -10); ctx.lineTo(88, -50 + Math.abs(wa) * 18);
  ctx.lineTo(76, -4); ctx.lineTo(50, 24); ctx.lineTo(22, 30);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#1a0a04'; ctx.lineWidth = 1.2;
  [0.7, 0.45, 0.2].forEach(t => {
    ctx.beginPath();
    ctx.moveTo(10 + t * 16, -10 + t * 7);
    ctx.lineTo(88 * (1 + t * 0.22), (-50 + Math.abs(wa) * 18) * (1 + t * 0.18));
    ctx.stroke();
  });
  ctx.restore();

  // 胴体
  ctx.fillStyle = rage ? '#8a3818' : '#6a4226'; ctx.strokeStyle = '#3a1a0a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 12, 32, 44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // 白い腹
  ctx.fillStyle = '#e8ddd0';
  ctx.beginPath(); ctx.ellipse(0, 22, 18, 28, 0, 0, Math.PI * 2); ctx.fill();

  // 頭（白頭鷲風）
  ctx.fillStyle = '#f0f0e6'; ctx.strokeStyle = '#c8c8b0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -34, 22, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // くちばし（鉤型）
  ctx.fillStyle = '#e8a800'; ctx.strokeStyle = '#a07800'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, -36); ctx.lineTo(44, -34); ctx.lineTo(36, -26); ctx.lineTo(12, -28);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); // 鉤先
  ctx.moveTo(44, -34); ctx.lineTo(49, -28); ctx.lineTo(42, -26); ctx.lineTo(36, -26);
  ctx.closePath(); ctx.fill();

  // 目（鋭い）
  ctx.fillStyle = '#ff8800';
  ctx.beginPath(); ctx.arc(11, -38, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(13, -38, 3, 0, Math.PI * 2); ctx.fill();
  // 眉毛（険しい）
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(7, -45); ctx.lineTo(18, -43); ctx.stroke();

  // 爪（タロン 3 本）
  ctx.fillStyle = '#3a2810'; ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 1.5;
  [[-18, 60], [-4, 64], [10, 60]].forEach(([tx, ty]) => {
    ctx.beginPath();
    ctx.moveTo(tx, ty - 8); ctx.lineTo(tx - 5, ty + 10); ctx.lineTo(tx + 5, ty + 10);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  ctx.restore();
}

// ============================================================
//  ボス「サンダーウルフ」スプライトシート（4フレーム横並び）
// ============================================================
let bossSpriteFrames = [];
const bossSpriteSheet = new Image();
bossSpriteSheet.crossOrigin = 'anonymous';
bossSpriteSheet.src = 'Remove_background_from_the_big_dog_boss_sprite_she-1771117746232.png';

// スプライトキャンバスの透明部分をトリミング（ボス・雑魚共通）
function trimSpriteCanvas(c) {
  const ctx2 = c.getContext('2d');
  const id = ctx2.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  let top = c.height, bottom = 0, left = c.width, right = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 10) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (top >= bottom) return c;
  const trimmed = document.createElement('canvas');
  const tw = right - left + 1, th = bottom - top + 1;
  trimmed.width = tw;
  trimmed.height = th;
  trimmed.getContext('2d').drawImage(c, left, top, tw, th, 0, 0, tw, th);
  return trimmed;
}

// スプライトシートから4フレームを解析して配列に詰める（ボス・雑魚共通ロジック）
function parseSpriteSheet4Frames(img, targetArray) {
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = imgW;
  tempCanvas.height = imgH;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);
  const imageData = tempCtx.getImageData(0, 0, imgW, imgH);
  const data = imageData.data;
  const colAlpha = new Float32Array(imgW);
  for (let x = 0; x < imgW; x++) {
    let sum = 0;
    for (let y = 0; y < imgH; y++) sum += data[(y * imgW + x) * 4 + 3];
    colAlpha[x] = sum;
  }
  const threshold = imgH * 2;
  const regions = [];
  let inSprite = false, startX = 0;
  for (let x = 0; x < imgW; x++) {
    if (!inSprite && colAlpha[x] > threshold) { inSprite = true; startX = x; }
    else if (inSprite && (colAlpha[x] <= threshold || x === imgW - 1)) {
      const endX = (x === imgW - 1 && colAlpha[x] > threshold) ? x + 1 : x;
      const regionW = endX - startX;
      if (regionW > 50) regions.push({ x: startX, w: regionW });
      inSprite = false;
    }
  }
  const count = regions.length === 4 ? regions.length : 4;
  const fw = Math.floor(imgW / count);
  for (let i = 0; i < count; i++) {
    const r = regions[i] || { x: i * fw, w: fw };
    const fc = document.createElement('canvas');
    fc.width = r.w;
    fc.height = imgH;
    const fctx = fc.getContext('2d');
    fctx.drawImage(img, r.x, 0, r.w, imgH, 0, 0, r.w, imgH);
    targetArray.push(trimSpriteCanvas(fc));
  }
}

bossSpriteSheet.onload = function() {
  parseSpriteSheet4Frames(bossSpriteSheet, bossSpriteFrames);
};

// ============================================================
//  雑魚キャラ（犬・少年・トラック）スプライトシート（各4フレーム横並び）
//  表示サイズはボス(216x192)の1/5 = 約43x38
// ============================================================
let dogSpriteFrames = [], kidSpriteFrames = [], truckSpriteFrames = [];

function loadMobSpriteSheet(src, targetArray) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  img.onload = function() { parseSpriteSheet4Frames(img, targetArray); };
}

loadMobSpriteSheet('Remove_background_from_the_dog_sprite_sheet_image-1771117740647.png', dogSpriteFrames);
loadMobSpriteSheet('Remove_background_from_the_kid_sprite_sheet_image-1771117749873.png', kidSpriteFrames);
loadMobSpriteSheet('Remove_background_from_the_truck_sprite_sheet_imag-1771117754481.png', truckSpriteFrames);

// 2面用SVG敵（カラス・風船・ハチ・ワシ）
const stage2Sprites = { crow: null, balloon: null, bee: null, eagle: null };
['crow','balloon','bee','eagle'].forEach((key, i) => {
  const img = new Image();
  img.onload = () => { stage2Sprites[key] = img; };
  img.src = ['enemy-crow.svg','enemy-balloon.svg','enemy-bee.svg','boss-eagle.svg'][i];
});

// ============================================================
//  言霊システム
// ============================================================
const KOTODAMA_LIST = [
  { text: 'ニャー',     power: 1.0,  range: 100, speed: 12, color: '#fff' },
  { text: 'シャーッ！',   power: 1.5,  range: 130, speed: 14, color: '#ff6b6b' },
  { text: 'フー！',     power: 0.8,  range: 90,  speed: 10, color: '#a29bfe' },
  { text: 'ゴロゴロ',    power: 0.6,  range: 150, speed: 8,  color: '#ffd93d' },
  { text: 'にゃんにゃん',  power: 1.8,  range: 160, speed: 11, color: '#ff9ff3' },
  { text: 'ミャオ',     power: 1.2,  range: 110, speed: 13, color: '#48dbfb' },
  { text: 'ナーオ',     power: 1.0,  range: 105, speed: 12, color: '#1dd1a1' },
  { text: 'カッ！',     power: 2.0,  range: 80,  speed: 18, color: '#ee5a24' },
  { text: 'にゃぁぁぁぁ', power: 2.5,  range: 200, speed: 9,  color: '#f368e0' },
  { text: 'プルルル',    power: 1.3,  range: 140, speed: 10, color: '#c8d6e5' },
];

let nextKotodamaIdx = 0;
function getNextKotodama() {
  const k = KOTODAMA_LIST[nextKotodamaIdx];
  nextKotodamaIdx = (nextKotodamaIdx + 1) % KOTODAMA_LIST.length;
  const _el1 = document.getElementById('nextKotodama');
  if (_el1) _el1.textContent = `次: ${KOTODAMA_LIST[nextKotodamaIdx].text}`;
  return k;
}

// ============================================================
//  吹き出し弾（言霊プロジェクタイル）
// ============================================================
let projectiles = [];

const MEOW_SIZE_SCALE = 1.1;
function spawnProjectile(kotodama, dir, startX, startY) {
  const baseW = kotodama.text.length * 14 + 20;
  const baseH = 28;
  projectiles.push({
    x: startX, y: startY,
    vx: dir * kotodama.speed,
    vy: 0,
    text: kotodama.text,
    power: kotodama.power,
    range: kotodama.range,
    color: kotodama.color,
    life: 60,
    startX: startX,
    w: Math.round(baseW * MEOW_SIZE_SCALE),
    h: Math.round(baseH * MEOW_SIZE_SCALE),
  });
}

// ============================================================
//  ゲーム状態
// ============================================================
let gameState = 'title'; // title → playing → over
let currentStage = 1;
// スコア集計
let enemiesDefeated = 0;
let maxComboAchieved = 0;
let scrollX = 0;
let screenShake = 0;
let animTick = 0;
let bossArenaScrollX = -1; // ステージ2ボス戦カメラ固定位置

// コンボシステム
let combo = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 120; // 120フレーム(約2秒)でリセット

function registerHit() {
  combo++;
  comboTimer = COMBO_TIMEOUT;
  if (combo > maxComboAchieved) maxComboAchieved = combo;
}

let player = {
  x: 100, y: GROUND_Y - 60, w: 60, h: 60,
  vx: 0, vy: 0, baseSpeed: 7, jumpPower: -14,
  hp: 100, maxHp: 100, stamina: 100, maxStamina: 100,
  isJumping: false, dir: 1, invincible: 0,
  // 主人公ネコ：アクション（座る/歩く/ジャンプ）
  animState: 'idle',   // idle | sit | walk | jump
  animFrame: 0, animTimer: 0,
  landingTimer: 0, meowAnimTimer: 0,
  dashTimer: 0, dashDir: 0,
  jumpHeld: false,     // 変則ジャンプ用（離すと上昇打ち切り）
};

let clouds = [];
let enemies = [], obstacles = [], items = [], boss = null, particles = [];

// 音声（BGM：1面＝春のグラウンド、2面＝夏マップ）
const bgmStage1 = new Audio('春のグラウンドマップ.mp3');
const bgmStage2 = new Audio('夏マップを歩こう.mp3');
bgmStage1.loop = true; bgmStage2.loop = true;
bgmStage1.volume = 1.0; bgmStage2.volume = 1.0;
let audioUnlocked = false;
let seAudioCtx = null;
function getSeContext() {
  if (!seAudioCtx) seAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // suspended状態のままだと音が出ないためresumeを呼ぶ
  if (seAudioCtx.state === 'suspended') seAudioCtx.resume();
  return seAudioCtx;
}
function playJumpSound() {
  if (!audioUnlocked) return;
  const ctx = getSeContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(380, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.50, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
}
function playMeowSound() {
  if (!audioUnlocked) return;
  const ctx = getSeContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, ctx.currentTime);
  osc.frequency.setValueAtTime(420, ctx.currentTime + 0.06);
  osc.frequency.setValueAtTime(280, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.48, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  playBGM(currentStage);
  document.removeEventListener('touchstart', unlockAudio);
  document.removeEventListener('mousedown', unlockAudio);
  document.removeEventListener('keydown', unlockAudio);
}
function playBGM(stageNum) {
  if (!audioUnlocked) return;
  bgmStage1.pause(); bgmStage2.pause();
  const bgm = stageNum === 1 ? bgmStage1 : bgmStage2;
  bgm.currentTime = 0;
  bgm.play().catch(() => {});
}
document.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
document.addEventListener('mousedown', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });
let platforms = [], pits = [], jumpPads = []; // コース凹凸・谷・ジャンプ台
let movingPlatforms = [], fallingPlatforms = []; // 動く床・落ちる床
let joyX = 0, joyY = 0, isTouchingJoy = false;
const keys = {};

function resetClouds() {
  clouds = Array.from({length:14}, () => ({
    x: Math.random() * 2400, y: 15 + Math.random() * 110, s: 0.6 + Math.random() * 0.8
  }));
}

// ============================================================
//  タイルマップシステム
// ============================================================
const TILE_SIZE = 40;
const TILE = { GROUND: 1, BRICK: 2, QMARK: 3, STONE: 4, JUMP_PAD: 5 };

function drawTile(type, tx, ty) {
  const s = TILE_SIZE;
  ctx.save();
  switch (type) {
    case TILE.GROUND:
      // 土台
      ctx.fillStyle = '#795548'; ctx.fillRect(tx, ty, s, s);
      // 草トップ
      ctx.fillStyle = '#27ae60'; ctx.fillRect(tx, ty, s, 10);
      ctx.fillStyle = '#2ecc71'; ctx.fillRect(tx + 4, ty, s - 8, 6);
      // レンガ模様
      ctx.fillStyle = '#5d4037';
      for (let row = 0; row < 3; row++) {
        const y0 = ty + 11 + row * 10;
        const off = row % 2 === 0 ? 0 : s / 2;
        ctx.fillRect(tx, y0, s, 1);
        for (let dx = off; dx < s; dx += s / 2) ctx.fillRect(tx + dx, y0, 1, 9);
      }
      break;
    case TILE.BRICK:
      ctx.fillStyle = '#c0392b'; ctx.fillRect(tx, ty, s, s);
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(tx + 1, ty + 1, s - 2, s - 2);
      ctx.fillStyle = '#922b21';
      ctx.fillRect(tx, ty + s / 2 - 1, s, 2);
      ctx.fillRect(tx + s / 2 - 1, ty + 1, 2, s / 2 - 2);
      ctx.fillRect(tx, ty + s / 2 + 1, 2, s / 2 - 2);
      ctx.fillRect(tx + s - 2, ty + s / 2 + 1, 2, s / 2 - 2);
      // ハイライト
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(tx + 1, ty + 1, s - 2, 4);
      break;
    case TILE.QMARK:
      // アニメーション（点滅）
      const pulse = 0.8 + 0.2 * Math.sin(animTick * 0.1);
      ctx.fillStyle = '#e67e22'; ctx.fillRect(tx, ty, s, s);
      ctx.fillStyle = `rgba(243,156,18,${pulse})`; ctx.fillRect(tx + 2, ty + 2, s - 4, s - 4);
      ctx.fillStyle = '#000';
      ctx.font = `bold ${Math.floor(s * 0.55)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', tx + s / 2, ty + s / 2 + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(tx + 3, ty + 3, s - 6, 6);
      break;
    case TILE.STONE:
      ctx.fillStyle = '#546e7a'; ctx.fillRect(tx, ty, s, s);
      ctx.fillStyle = '#78909c'; ctx.fillRect(tx + 1, ty + 1, s - 2, Math.floor(s * 0.5) - 1);
      ctx.fillStyle = '#37474f'; ctx.fillRect(tx, ty + s - 4, s, 4);
      ctx.fillStyle = '#455a64'; ctx.fillRect(tx, ty, 3, s);
      ctx.fillStyle = '#90a4ae'; ctx.fillRect(tx + 3, ty + 2, 3, Math.floor(s * 0.35));
      break;
    case TILE.JUMP_PAD:
      ctx.fillStyle = '#558b2f'; ctx.fillRect(tx, ty, s, s);
      ctx.fillStyle = '#8bc34a'; ctx.fillRect(tx + 1, ty + 1, s - 2, s - 2);
      ctx.fillStyle = '#cddc39'; ctx.fillRect(tx + 2, ty + 2, s - 4, 8);
      ctx.fillStyle = '#1b5e20';
      ctx.font = `bold ${Math.floor(s * 0.5)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('▲', tx + s / 2, ty + s / 2 + 2);
      break;
  }
  ctx.restore();
}

// タイルマップ定義 → platforms[] に変換する
// { col, row, type, w } で指定。row は地面からのタイル数 (1=G-40, 2=G-80, ...)
function parseTilemap(tilemap) {
  tilemap.forEach(t => {
    platforms.push({
      x: t.col * TILE_SIZE,
      y: GROUND_Y - t.row * TILE_SIZE,
      w: (t.w || 1) * TILE_SIZE,
      h: TILE_SIZE,
      tileType: t.type,
    });
  });
}

// ---- ステージ1 タイルマップ ----
// 低台(row2=G-80), 中台(row4=G-160), 高台(row6=G-240), はてなブロック(row3=G-120)
const STAGE1_TILEMAP = [
  // 低台 (STONE)
  { col: 30, row: 2, type: TILE.STONE,  w: 4 },  // x=1200
  { col: 45, row: 2, type: TILE.STONE,  w: 3 },  // x=1800
  { col: 62, row: 2, type: TILE.STONE,  w: 5 },  // x=2480
  { col: 80, row: 2, type: TILE.STONE,  w: 4 },  // x=3200
  { col:100, row: 2, type: TILE.STONE,  w: 6 },  // x=4000
  // 中台 (BRICK)
  { col: 33, row: 4, type: TILE.BRICK,  w: 3 },  // x=1320
  { col: 48, row: 4, type: TILE.BRICK,  w: 2 },  // x=1920
  { col: 65, row: 4, type: TILE.BRICK,  w: 3 },  // x=2600
  { col: 83, row: 4, type: TILE.BRICK,  w: 2 },  // x=3320
  { col:103, row: 4, type: TILE.BRICK,  w: 2 },  // x=4120
  // 高台 (BRICK)
  { col: 35, row: 6, type: TILE.BRICK,  w: 2 },  // x=1400
  { col: 50, row: 6, type: TILE.BRICK,  w: 2 },  // x=2000
  { col: 69, row: 6, type: TILE.BRICK,  w: 2 },  // x=2760
  { col: 87, row: 6, type: TILE.BRICK,  w: 2 },  // x=3480
  { col:106, row: 6, type: TILE.BRICK,  w: 2 },  // x=4240
  // はてなブロック (QMARK) ─ ジャンプで踏める足場も兼ねる
  { col: 27, row: 3, type: TILE.QMARK,  w: 1 },  // x=1080
  { col: 42, row: 3, type: TILE.QMARK,  w: 1 },  // x=1680
  { col: 58, row: 3, type: TILE.QMARK,  w: 1 },  // x=2320
  { col: 77, row: 3, type: TILE.QMARK,  w: 1 },  // x=3080 (谷の上)
  { col: 96, row: 3, type: TILE.QMARK,  w: 1 },  // x=3840
];

// ---- ステージ1 谷・ジャンプ台 (タイル座標) ----
const STAGE1_PITS     = [
  { col: 37, w: 3 },   // x=1480, w=120
  { col: 52, w: 3 },   // x=2080, w=120
  { col: 75, w: 4 },   // x=3000, w=160
  { col: 91, w: 2 },   // x=3640, w=80
];
const STAGE1_JUMPPADS = [
  { col: 22, boost: -22 },  // x=880
  { col: 55, boost: -24 },  // x=2200
  { col: 85, boost: -21 },  // x=3400
];

// ============================================================
//  ステージ初期化
// ============================================================
function initStage(num) {
  currentStage = num;
  document.getElementById('stageNum').textContent = num;
  scrollX = 0;
  player.x = 100; player.y = GROUND_Y - player.h;
  player.hp = player.maxHp; player.stamina = player.maxStamina;
  player.vx = 0; player.vy = 0; player.isJumping = false; player.invincible = 0;
  player.animState = 'idle'; player.animFrame = 0; player.animTimer = 0;
  player.landingTimer = 0; player.meowAnimTimer = 0;
  player.dashTimer = 0; player.jumpHeld = false;
  enemies = []; obstacles = []; items = []; boss = null; projectiles = []; particles = [];
  platforms = []; pits = []; jumpPads = [];
  movingPlatforms = []; fallingPlatforms = [];
  document.getElementById('bossBarContainer').style.display = 'none';
  resetClouds();
  nextKotodamaIdx = Math.floor(Math.random() * KOTODAMA_LIST.length);
  const _el2 = document.getElementById('nextKotodama');
  if (_el2) _el2.textContent = `次: ${KOTODAMA_LIST[nextKotodamaIdx].text}`;
  playBGM(num);

  if (num === 2) {
    initStage2();
    return;
  }

  // 1面：タイルマップからプラットフォーム・谷・ジャンプ台を生成
  parseTilemap(STAGE1_TILEMAP);
  STAGE1_PITS.forEach(p => pits.push({ x: p.col * TILE_SIZE, w: p.w * TILE_SIZE }));
  STAGE1_JUMPPADS.forEach(p => jumpPads.push({
    x: p.col * TILE_SIZE, y: GROUND_Y - TILE_SIZE,
    w: TILE_SIZE, h: TILE_SIZE, boost: p.boost,
  }));

  // 動く床（左右に往復）
  movingPlatforms.push(
    { x: 1100, y: GROUND_Y - 50, w: 100, h: 20, startX: 1050, endX: 1300, speed: 2.2, dir: 1 },
    { x: 1650, y: GROUND_Y - 70, w: 120, h: 18, startX: 1550, endX: 1850, speed: 1.8, dir: -1 },
    { x: 2700, y: GROUND_Y - 55, w: 90, h: 22, startX: 2600, endX: 2850, speed: 2.5, dir: 1 },
    { x: 3500, y: GROUND_Y - 65, w: 110, h: 20, startX: 3400, endX: 3650, speed: 2.0, dir: -1 }
  );

  // 落ちる床（乗ると落下開始、数秒後に崩落）
  fallingPlatforms.push(
    { x: 1400, y: GROUND_Y - 45, w: 80, h: 18, triggered: false, vy: 0, delay: 0 },
    { x: 2000, y: GROUND_Y - 60, w: 70, h: 16, triggered: false, vy: 0, delay: 0 },
    { x: 2600, y: GROUND_Y - 50, w: 85, h: 20, triggered: false, vy: 0, delay: 0 },
    { x: 3300, y: GROUND_Y - 55, w: 75, h: 18, triggered: false, vy: 0, delay: 0 },
    { x: 3900, y: GROUND_Y - 40, w: 90, h: 16, triggered: false, vy: 0, delay: 0 }
  );

  let lastX = 700;
  const count = 28 + num * 6;  // 雑魚・障害物・アイテムの総数を増加
  for (let i = 0; i < count; i++) {
    lastX += 120 + Math.random() * 200;  // 出現間隔を詰める
    if (lastX > STAGE_LENGTH - 1200) break;

    const r = Math.random();
    if (r < 0.7) {
      // 雑魚出現頻度UP（0.5→0.7）、各タイプに動き用パラメータを付与
      const types = [
        { type:'dog',   frames: dogFrames,   w:73, h:73, speed:1.2, wanderPhase: Math.random()*Math.PI*2 },   // 56*1.3≈73
        { type:'kid',   frames: kidFrames,   w:43, h:52, speed:2.2, vy:0, jumpPower: -12 },
        { type:'truck', frames: truckFrames, w:91, h:70, speed:2.5, chargeSpeed: 8, chargeDist: 500 },  // 高さ1:横1.3 → 70×91
      ];
      const t = types[Math.floor(Math.random()*3)];
      enemies.push({
        type: t.type, frames: t.frames,
        x: lastX, y: GROUND_Y - t.h,
        w: t.w, h: t.h,
        baseSpeed: t.speed,
        vx: -(t.speed + num * 0.2),
        vy: t.type === 'kid' ? 0 : undefined,
        animFrame: 0, animTimer: 0,
        isBlownAway: false, blowVx: 0, blowVy: 0, blowRot: 0,
        hp: t.type === 'truck' ? 3 : 1,
        // タイプ別パラメータ
        wanderPhase: t.wanderPhase,
        jumpPower: t.jumpPower,
        chargeSpeed: t.chargeSpeed,
        chargeDist: t.chargeDist,
      });
    } else if (r < 0.88) {
      obstacles.push({ x: lastX, y: GROUND_Y - 50, w: 50, h: 50, spriteIdx: Math.floor(Math.random() * Math.max(obstacleSprites.length, 9)) });
    } else {
      items.push({ x: lastX, y: GROUND_Y - 100 - Math.random() * 80, w: 36, h: 36, collected: false, bobPhase: Math.random() * Math.PI * 2 });
    }
  }

  // 1面：ボス サンダーウルフ
  boss = {
    x: STAGE_LENGTH + 200, y: GROUND_Y - 192, w: 216, h: 192,
    hp: 60 + 30 * num, maxHp: 60 + 30 * num,
    active: false, vx: -2.0,
    animState: 'idle', animFrame: 0, animTimer: 0,
    attackCooldown: 0,
    stage: 1, bossLabel: 'BIG DOG',
  };
  document.getElementById('bossBarContainer').querySelector('div').textContent = '◆ BIG DOG ◆';

  showStageInfo(`STAGE ${num}`);
}

function initStage2() {
  // 2面：屋根の上を伝う空中ステージ（民家の屋根＝平台）
  const G = GROUND_Y;
  platforms = []; pits = []; jumpPads = []; movingPlatforms = []; fallingPlatforms = [];
  obstacles = []; enemies = []; items = [];

  // プレイヤーを最初の屋根上に配置
  const firstRoof = { x: 200, y: G - 50, w: 180, h: 25 };
  player.x = 220;
  player.y = firstRoof.y - player.h;

  // 屋根として平台を配置（傾斜屋根風に複数段）
  const roofH = 25;
  platforms.push(
    { x: 200, y: G - 50, w: 180, h: roofH },
    { x: 500, y: G - 90, w: 200, h: roofH },
    { x: 850, y: G - 60, w: 220, h: roofH },
    { x: 1200, y: G - 110, w: 190, h: roofH },
    { x: 1550, y: G - 70, w: 200, h: roofH },
    { x: 1900, y: G - 100, w: 180, h: roofH },
    { x: 2250, y: G - 55, w: 210, h: roofH },
    { x: 2620, y: G - 95, w: 200, h: roofH },
    { x: 2980, y: G - 65, w: 190, h: roofH },
    { x: 3330, y: G - 105, w: 220, h: roofH },
    { x: 3700, y: G - 75, w: 200, h: roofH },
    { x: 4050, y: G - 55, w: 250, h: roofH }
  );

  // 雑魚：カラス・風船・ハチ（第1面サイズ踏襲）
  let lastX = 400;
  const mobTypes = [
    { type: 'crow', w: 73, h: 73, speed: 2.0, glidePhase: Math.random() * Math.PI * 2 },
    { type: 'balloon', w: 52, h: 73, speed: 0.8, floatPhase: Math.random() * Math.PI * 2 },
    { type: 'bee', w: 43, h: 52, speed: 2.5, zigzagPhase: Math.random() * Math.PI * 2 },
  ];
  for (let i = 0; i < 24; i++) {
    lastX += 150 + Math.random() * 120;
    if (lastX > STAGE_LENGTH - 1000) break;
    const t = mobTypes[Math.floor(Math.random() * 3)];
    const plat = platforms.find(p => lastX >= p.x && lastX <= p.x + p.w) || platforms[0];
    const baseY = plat ? plat.y - t.h : G - t.h;
    enemies.push({
      type: t.type, frames: [],
      x: lastX, y: baseY,
      w: t.w, h: t.h,
      baseSpeed: t.speed, vx: -t.speed, vy: 0,
      animFrame: 0, animTimer: 0,
      isBlownAway: false, blowVx: 0, blowVy: 0, blowRot: 0,
      hp: 1,
      glidePhase: t.glidePhase, floatPhase: t.floatPhase, zigzagPhase: t.zigzagPhase,
    });
  }

  // ボス：ワシ（第1面ボスサイズ踏襲 216x192）
  boss = {
    x: STAGE_LENGTH + 200, y: G - 192, w: 216, h: 192,
    hp: 75, maxHp: 75,
    active: false, vx: -2.5, vy: 0,
    animState: 'idle', animFrame: 0, animTimer: 0,
    stage: 2, bossLabel: 'EAGLE',
    patrolPhase: 0,      // 通常モード：サイン波Y位置用
    circleWaypoint: 0,   // 旋回モード：現在の目標ウェイポイント(0-3)
  };

  // ボス戦アリーナの雲足場（player.x > STAGE_LENGTH-900 で出現するエリア内に配置）
  const arenaBase = STAGE_LENGTH - 850;
  platforms.push(
    { x: arenaBase - 60,  y: G - 250, w: 150, h: 45, isCloud: true },  // 雲0：左・G-250
    { x: arenaBase + 50,  y: G - 110, w: 160, h: 45, isCloud: true },  // 雲1：低め左
    { x: arenaBase + 280, y: G - 210, w: 140, h: 45, isCloud: true },  // 雲2：中高右
    { x: arenaBase + 500, y: G - 300, w: 150, h: 45, isCloud: true },  // 雲3：高め右端
  );

  // カメラ固定位置をリセット
  bossArenaScrollX = -1;

  document.getElementById('bossBarContainer').querySelector('div').textContent = '◆ EAGLE ◆';
  showStageInfo('STAGE 2 - 屋根の上');
}

function showStageInfo(txt, duration = 1800) {
  const info = document.getElementById('stageInfo');
  info.textContent = txt; info.style.opacity = 1;
  clearTimeout(info._timer);
  info._timer = setTimeout(() => info.style.opacity = 0, duration);
}

// ============================================================
//  入力（ジョイスティック・ボタン参照はここで取得）
// ============================================================
const joystickArea = document.getElementById('joystickArea');
const joystickHandle = document.getElementById('joystickHandle');
const actionBtn = document.getElementById('actionBtn');

function centerJoystick() {
  const rect = joystickArea.getBoundingClientRect();
  joystickHandle.style.left = (rect.width/2 - 23) + 'px';
  joystickHandle.style.top = (rect.height/2 - 23) + 'px';
  joystickHandle.style.transform = '';
}
centerJoystick();

function updateJoystick(cx, cy) {
  const rect = joystickArea.getBoundingClientRect();
  const cxR = rect.left + rect.width/2, cyR = rect.top + rect.height/2;
  let dx = cx - cxR, dy = cy - cyR;
  const dist = Math.sqrt(dx*dx+dy*dy), maxD = rect.width/2 - 10;
  if (dist > maxD) { dx *= maxD/dist; dy *= maxD/dist; }
  joyX = dx / maxD; joyY = dy / maxD;
  joystickHandle.style.left = (rect.width/2 - 23 + dx) + 'px';
  joystickHandle.style.top = (rect.height/2 - 23 + dy) + 'px';
  if (joyY < -0.45 && !player.isJumping && player.stamina >= 15) jump(); // 閾値を緩和（-0.55→-0.45）
}

function resetJoystick() {
  isTouchingJoy = false; joyX = 0; joyY = 0;
  centerJoystick();
}

function jump() {
  player.vy = player.jumpPower; player.isJumping = true; player.jumpHeld = true;
  player.stamina -= 15;
  playJumpSound();
}

function tryDash() {
  if (gameState !== 'playing' || player.stamina < 25 || player.dashTimer > 0) return;
  player.stamina -= 25;
  player.dashTimer = 14;
  player.dashDir = player.dir;
}

function triggerMeow(e) {
  if (e) e.preventDefault();
  if (player.stamina < 20 || gameState !== 'playing') return;
  const kotodama = getNextKotodama();
  player.stamina -= 20;
  player.meowAnimTimer = 24;
  playMeowSound();
  const sx = player.x + (player.dir === 1 ? player.w : 0);
  const sy = player.y + player.h / 2 - 10;
  spawnProjectile(kotodama, player.dir, sx, sy);
  createParticles(sx, sy, kotodama.color, 8);
  screenShake = 4;
}

function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({ x, y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, life:18+Math.random()*10, maxLife:28, color, size: 2+Math.random()*3 });
  }
}

function onFirstInput() { unlockAudio(); }
joystickArea.addEventListener('touchstart', e => { onFirstInput(); e.preventDefault(); isTouchingJoy=true; updateJoystick(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
joystickArea.addEventListener('touchmove', e => { e.preventDefault(); if(isTouchingJoy) updateJoystick(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
joystickArea.addEventListener('touchend', e => { e.preventDefault(); resetJoystick(); }, {passive:false});
joystickArea.addEventListener('mousedown', e => { onFirstInput(); isTouchingJoy=true; updateJoystick(e.clientX, e.clientY); });
window.addEventListener('mousemove', e => { if(isTouchingJoy) updateJoystick(e.clientX, e.clientY); });
window.addEventListener('mouseup', () => resetJoystick());
const dashBtn = document.getElementById('dashBtn');
dashBtn.addEventListener('mousedown', e => { onFirstInput(); e.preventDefault(); tryDash(); });
dashBtn.addEventListener('touchstart', e => { onFirstInput(); e.preventDefault(); tryDash(); }, {passive:false});
actionBtn.addEventListener('mousedown', e => { onFirstInput(); triggerMeow(e); });
actionBtn.addEventListener('touchstart', e => { onFirstInput(); triggerMeow(e); }, {passive:false});
window.addEventListener('keydown', e => {
  onFirstInput();
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'KeyZ') triggerMeow(e);
  if (e.code === 'KeyX' || e.code === 'ShiftLeft') tryDash();
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') player.jumpHeld = false;
});

// ============================================================
//  衝突判定・コース判定ヘルパー
// ============================================================
function rectOverlap(ax,ay,aw,ah, bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

function isInPit(px) {
  return pits.some(p => px >= p.x && px <= p.x + p.w);
}


// ============================================================
//  UPDATE
// ============================================================
function update(dt) {
  if (gameState !== 'playing') return;
  animTick++;
  if (screenShake > 0.5) screenShake *= Math.pow(0.85, dt); else screenShake = 0;

  // コンボタイマー
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) { comboTimer = 0; combo = 0; }
  }
  if (player.invincible > 0) player.invincible--;

  function setPlayerAnim(next) {
    if (player.animState !== next) {
      player.animState = next;
      player.animFrame = 0;
      player.animTimer = 0;
    }
  }

  // 入力
  let moveX = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) moveX -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) moveX += 1;
  if ((keys['ArrowUp'] || keys['KeyW']) && !player.isJumping && player.stamina >= 15) jump();
  const sitPressed = (keys['ArrowDown'] || keys['KeyS']);

  if (isTouchingJoy) {
    player.vx = joyX * player.baseSpeed;
    if (Math.abs(joyX) > 0.15) player.dir = joyX > 0 ? 1 : -1;
    if (joyY > -0.4) player.jumpHeld = false;
  } else if (moveX !== 0) {
    player.vx = moveX * player.baseSpeed;
    player.dir = moveX > 0 ? 1 : -1;
  }

  // ダッシュ中は速度を上書き
  if (player.dashTimer > 0) {
    player.vx = player.dashDir * 18;
    player.dashTimer--;
  }

  // 物理（軽やかジャンプ：上昇中は重力弱めで滞空長く、落下はやや強め＝動物の弧をイメージ）
  const gravity = player.vy < 0 ? 0.48 : 0.72;
  player.vy += gravity * dt;
  // 変則ジャンプ：ボタン離すと上昇を打ち切り（-5→-8に緩和し、急落下を抑制）
  if (player.isJumping && !player.jumpHeld && player.vy < 0) player.vy = Math.max(player.vy, -8);
  player.y += player.vy * dt;
  player.x += player.vx * dt;
  if (player.dashTimer <= 0) player.vx *= Math.pow(0.88, dt);

  // 動く床の更新
  movingPlatforms.forEach(mp => {
    mp.x += mp.speed * mp.dir * dt;
    if (mp.x <= mp.startX) { mp.x = mp.startX; mp.dir = 1; }
    if (mp.x >= mp.endX) { mp.x = mp.endX; mp.dir = -1; }
  });

  // 落ちる床の更新（乗られると遅延後に落下）
  fallingPlatforms.forEach(fp => {
    if (fp.triggered) {
      fp.delay--;
      if (fp.delay <= 0) {
        fp.vy += 0.8 * dt;
        fp.y += fp.vy * dt;
      }
    }
  });

  const px = player.x + player.w / 2;  // プレイヤー中心X（着地・床判定で使用）

  // 落ちる床の上にいる間、プレイヤーも一緒に落下
  if (!player.isJumping && Math.abs(player.vy) < 2) {
    const footY = player.y + player.h;
    for (const fp of fallingPlatforms) {
      if (fp.triggered && fp.delay <= 0 && fp.y < GROUND_Y + 400 &&
          px >= fp.x && px <= fp.x + fp.w && Math.abs(footY - fp.y) < 20) {
        player.y = fp.y - player.h;
        break;
      }
    }
  }

  // 着地判定：ジャンプ台 → 動く床 → 落ちる床 → 平台 → メイン地面（谷の上は落下）
  let landed = false;

  for (const jp of jumpPads) {
    if (px >= jp.x && px <= jp.x + jp.w && player.vy > 0 &&
        player.y + player.h - player.vy * 1.1 <= jp.y + jp.h && player.y + player.h >= jp.y) {
        player.y = jp.y - player.h;
      player.vy = jp.boost;
      player.isJumping = true;
      landed = true;
      createParticles(player.x + player.w/2, player.y + player.h, '#aaffaa', 6);
      break;
    }
  }
  if (!landed) {
    for (const mp of movingPlatforms) {
      if (px >= mp.x && px <= mp.x + mp.w && player.vy > 0 &&
          player.y + player.h - player.vy * 1.1 <= mp.y + mp.h + 8 && player.y + player.h >= mp.y) {
        player.y = mp.y - player.h;
        player.vy = 0;
        player.isJumping = false;
        player.landingTimer = 14;
        landed = true;
        break;
      }
    }
  }
  if (!landed) {
    for (const fp of fallingPlatforms) {
      if (fp.y < GROUND_Y + 500 && px >= fp.x && px <= fp.x + fp.w && player.vy > 0 &&
          player.y + player.h - player.vy * 1.1 <= fp.y + fp.h + 8 && player.y + player.h >= fp.y) {
        player.y = fp.y - player.h;
        player.vy = 0;
        player.isJumping = false;
        player.landingTimer = 14;
        landed = true;
        if (!fp.triggered) {
          fp.triggered = true;
          fp.delay = 45;  // 約0.75秒後に落下開始
        }
        break;
      }
    }
  }
  if (!landed) {
    for (const pl of platforms) {
      if (px >= pl.x && px <= pl.x + pl.w && player.vy > 0 &&
          player.y + player.h >= pl.y &&
          player.y + player.h - player.vy * 1.1 <= pl.y + 8) {
        player.y = pl.y - player.h;
        player.vy = 0;
        player.isJumping = false;
        player.landingTimer = 14;
        landed = true;
        break;
      }
    }
  }
  if (!landed && currentStage === 2 && player.y > GROUND_Y + 60 && player.vy > 0) {
    // 2面：屋根から落下
    player.hp -= 25;
    player.invincible = 90;
    const firstRoof = platforms[0];
    player.x = firstRoof ? firstRoof.x + 20 : 220;
    player.y = firstRoof ? firstRoof.y - player.h : GROUND_Y - player.h;
    player.vy = -6;
    player.isJumping = true;
    screenShake = 15;
    createParticles(px, GROUND_Y, '#ff4757', 12);
  }
  if (!landed && currentStage !== 2 && !isInPit(px) && player.y > GROUND_Y - player.h) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.isJumping = false;
    player.landingTimer = 14;
  }
  if (!landed && currentStage !== 2 && isInPit(px) && player.y > GROUND_Y + 40 && player.vy > 0) {
    // 谷に落下：ダメージ＋リスポーン（直前の安全地帯＝谷の左端の手前へ）
    const pit = pits.find(p => px >= p.x && px <= p.x + p.w);
    player.hp -= 20;
    player.invincible = 90;
    player.x = pit ? pit.x - 100 : scrollX + 120;
    player.y = GROUND_Y - player.h;
    player.vy = -6;
    player.isJumping = true;
    screenShake = 15;
    createParticles(px, GROUND_Y, '#ff4757', 12);
  }
  if (player.x < scrollX - 50) player.x = scrollX - 50;

  // 動く床の上にいる間、床の移動に連動（毎フレーム判定）
  if (!player.isJumping && Math.abs(player.vy) < 2) {
    const footY = player.y + player.h;
    for (const mp of movingPlatforms) {
      const platformTop = mp.y;
      if (px >= mp.x && px <= mp.x + mp.w && Math.abs(footY - platformTop) < 15) {
        player.x += mp.speed * mp.dir;
        break;
      }
    }
  }

  // スタミナ回復
  if (player.stamina < player.maxStamina) player.stamina = Math.min(player.maxStamina, player.stamina + 0.35);

  // 主人公ネコ：アクション状態（↓座る / 横歩く / ↑ジャンプ）
  if (player.isJumping) {
    setPlayerAnim('jump');
  } else if (sitPressed || (isTouchingJoy && joyY > 0.55 && Math.abs(joyX) < 0.2)) {
    setPlayerAnim('sit');
  } else if (Math.abs(player.vx) > 0.55) {
    setPlayerAnim('walk');
  } else {
    setPlayerAnim('idle');
  }

  // コマ送り（スプライトシートが無い時は従来2コマに合わせて制限）
  player.animTimer++;
  const interval = (player.animState === 'idle' || player.animState === 'sit') ? 10 : 6;
  const maxFrames = catSheetLoaded ? 4 : 2;
  if (player.animTimer >= interval) {
    player.animTimer = 0;
    player.animFrame = (player.animFrame + 1) % maxFrames;
  }

  // カメラ
  const targetScroll = player.x - 220;
  scrollX += (targetScroll - scrollX) * 0.4;  // 5倍速で画面追従
  if (scrollX < 0) scrollX = 0;
  // ステージ2ボス戦：カメラ固定
  if (boss && boss.active && currentStage === 2) {
    if (bossArenaScrollX < 0) bossArenaScrollX = scrollX;
    scrollX = bossArenaScrollX;
  }

  // 障害物衝突
  obstacles.forEach(ob => {
    if (rectOverlap(player.x, player.y, player.w, player.h, ob.x, ob.y, ob.w, ob.h)) {
      if (player.vy > 0 && player.y + player.h - player.vy*1.1 <= ob.y) {
        player.y = ob.y - player.h; player.vy = 0; player.isJumping = false;
      } else if (player.vx > 0) {
        player.x = ob.x - player.w; player.vx = 0;
      } else {
        player.x = ob.x + ob.w; player.vx = 0;
      }
    }
  });

  // アイテム取得
  items.forEach(it => {
    if (!it.collected && rectOverlap(player.x, player.y, player.w, player.h, it.x, it.y-4, it.w, it.h)) {
      it.collected = true;
      player.hp = Math.min(player.maxHp, player.hp + 25);
      createParticles(it.x + it.w/2, it.y + it.h/2, '#ffd700', 18);
    }
  });

  // 敵更新（トラック突進・子供跳ね・犬うろうろ）
  enemies.forEach(en => {
    if (en.isBlownAway) {
      en.x += en.blowVx * dt; en.y += en.blowVy * dt; en.blowVy += 0.6 * dt; en.blowRot += 0.2 * dt;
      return;
    }

    const distToPlayer = en.x - player.x;  // 正のとき敵が右（プレイヤーの前方）

    // トラック：突進（プレイヤーが近いと加速）
    if (en.type === 'truck') {
      const chargeDist = en.chargeDist || 500;
      if (distToPlayer > 0 && distToPlayer < chargeDist) {
        en.vx = -(en.chargeSpeed || 8);  // 突進スピード
      } else {
        en.vx = -(en.baseSpeed || 2.5);
      }
    }
    // 子供：ぴょんぴょん跳ねる
    else if (en.type === 'kid') {
      en.vy = (en.vy || 0) + 0.6 * dt;
      en.y += en.vy * dt;
      const groundY = GROUND_Y - en.h;
      if (en.y >= groundY) {
        en.y = groundY;
        en.vy = (en.jumpPower || -12) - Math.random() * 2;
      }
    }
    // 犬：うろうろしながら近づく（左右に揺れつつ左移動）
    else if (en.type === 'dog') {
      en.wanderPhase = (en.wanderPhase || 0) + 0.08;
      const wobble = Math.sin(en.wanderPhase) * 0.8;
      en.vx = -(en.baseSpeed || 1.2) + wobble;
    }
    // 2面：カラス＝滑空しながら左へ、風船＝ふわふわ浮遊、ハチ＝ジグザグ突進
    else if (en.type === 'crow') {
      en.glidePhase = (en.glidePhase || 0) + 0.06;
      en.vy = Math.sin(en.glidePhase) * 0.5;
      en.vx = -(en.baseSpeed || 2);
      en.y += en.vy * dt;
    } else if (en.type === 'balloon') {
      en.floatPhase = (en.floatPhase || 0) + 0.04;
      en.vy = Math.sin(en.floatPhase) * 0.3;
      en.vx = -(en.baseSpeed || 0.8);
      en.y += en.vy * dt;
    } else if (en.type === 'bee') {
      en.zigzagPhase = (en.zigzagPhase || 0) + 0.15;
      en.vx = -(en.baseSpeed || 2.5) + Math.sin(en.zigzagPhase) * 1.5;
      en.vy = Math.cos(en.zigzagPhase * 0.7) * 1.2;
      en.y += en.vy * dt;
    }

    en.x += en.vx * dt;
    en.animTimer++;
    const interval = en.type === 'truck' ? 5 : 10;
    const mobFrames = en.type === 'dog' ? dogSpriteFrames : en.type === 'kid' ? kidSpriteFrames : truckSpriteFrames;
    const frameCount = mobFrames.length > 0 ? mobFrames.length : en.frames.length;
    if (en.animTimer > interval) { en.animFrame = (en.animFrame + 1) % frameCount; en.animTimer = 0; }

    // 敵→プレイヤー衝突（厳格な当たり判定）。上から踏んだ場合は踏みつけ（何回でも可）、それ以外は被弾
    if (player.invincible <= 0 && rectOverlap(player.x, player.y, player.w, player.h, en.x, en.y, en.w, en.h)) {
      const playerBottom = player.y + player.h;
      const stompThreshold = 24; // 踏みつけ判定を広めに（18→24）
      const isStomp = player.vy > 0 && playerBottom >= en.y && playerBottom <= en.y + stompThreshold;
      if (isStomp) {
        en.hp -= 1;
        registerHit();
        const stompKnockback = 14;
        const catBounceVx = 6;
        if (en.hp <= 0) {
          en.isBlownAway = true;
          en.blowVx = player.dir * 10;
          en.blowVy = -6;
          enemiesDefeated++;
          createParticles(en.x + en.w/2, en.y + en.h/2, '#ffd700', 12);
        } else {
          en.x += player.dir * stompKnockback;
          if (en.x < scrollX - 50) en.x = scrollX - 50;
          createParticles(en.x + en.w/2, en.y + en.h/2, '#ffaa00', 6);
        }
        player.y = en.y - player.h;
        player.vy = -12;
        player.vx = player.dir * catBounceVx;
        player.isJumping = true;
        player.jumpHeld = true;
        screenShake = 4;
      } else {
        const dmg = en.type === 'truck' ? 18 : 10;
        player.hp -= dmg;
        player.invincible = 40;
        player.vx = (player.x + player.w / 2 < en.x + en.w / 2 ? -1 : 1) * 10; // 中心基準でノックバック方向を判定
        player.vy = -6;
        screenShake = 12;
        createParticles(player.x + player.w/2, player.y + player.h/2, '#ff4757', 12);
      }
    }
  });

  // 弾（言霊）更新
  projectiles.forEach((p, pi) => {
    p.x += p.vx * dt;
    p.life--;
    const traveled = Math.abs(p.x - p.startX);
    if (p.life <= 0 || traveled > p.range * 3) { projectiles.splice(pi, 1); return; }

    // 弾→敵衝突
    enemies.forEach(en => {
      if (en.isBlownAway) return;
      if (rectOverlap(p.x - p.w/2, p.y - p.h/2, p.w, p.h, en.x, en.y, en.w, en.h)) {
        en.hp -= p.power;
        registerHit();
        if (en.hp <= 0) {
          en.isBlownAway = true;
          en.blowVx = p.vx > 0 ? 12 : -12;
          en.blowVy = -10;
          enemiesDefeated++;
          createParticles(en.x + en.w/2, en.y + en.h/2, '#ffd700', 15);
        } else {
          en.x += (p.vx > 0 ? 15 : -15);
          createParticles(en.x + en.w/2, en.y + en.h/2, p.color, 8);
        }
        p.life = 0;
      }
    });

    // 弾→ボス衝突
    if (boss && boss.active) {
      if (rectOverlap(p.x - p.w/2, p.y - p.h/2, p.w, p.h, boss.x, boss.y, boss.w, boss.h)) {
        boss.hp -= p.power * 2;
        createParticles(p.x, p.y, p.color, 12);
        document.getElementById('bossHpBar').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
        screenShake = 6;
        p.life = 0;
      }
    }
  });

  // ボス
  if (boss) {
    if (!boss.active && player.x > STAGE_LENGTH - 900) {
      boss.active = true;
      document.getElementById('bossBarContainer').style.display = 'block';
      document.getElementById('bossBarContainer').querySelector('div').textContent = `◆ ${boss.bossLabel || 'BOSS'} ◆`;
      document.getElementById('bossHpBar').style.width = '100%';
      showStageInfo('◆ BOSS ◆', 2800);
    }
    if (boss.active) {
      const dist = Math.abs(boss.x - player.x);
      const speed = Math.abs(boss.vx);
      if (boss.stage === 2) {
        // アニメーションコマ送り
        boss.animTimer++;
        if (boss.animTimer > 10) { boss.animFrame = (boss.animFrame + 1) % 2; boss.animTimer = 0; }

        const isRage = boss.hp < boss.maxHp * 0.5;
        boss.animState = isRage ? 'rage' : 'idle';

        if (!isRage) {
          // ─── 通常モード：雄大にサイン波で上下しながら左右往復 ───
          boss.patrolPhase += 0.018 * dt;
          // 左右：画面端で折り返し
          boss.x += boss.vx * dt;
          const leftBound  = scrollX + 40;
          const rightBound = scrollX + canvas.width - boss.w - 40;
          if (boss.x <= leftBound)  { boss.x = leftBound;  boss.vx =  Math.abs(boss.vx); }
          if (boss.x >= rightBound) { boss.x = rightBound; boss.vx = -Math.abs(boss.vx); }
          // 上下：ゆったりサイン波（Y=40〜220あたりを雄大に往復）
          boss.y = 40 + (Math.sin(boss.patrolPhase) * 0.5 + 0.5) * (canvas.height - boss.h - 100);
        } else {
          // ─── 旋回モード：左上→右下→右上→左下 の4点を高速で巡回 ───
          const lx = scrollX + 50;
          const rx = scrollX + canvas.width - boss.w - 50;
          const ty = 30;
          const by = canvas.height - boss.h - 55;
          const waypoints = [
            { x: lx, y: ty },   // 0: 左上
            { x: rx, y: by },   // 1: 右下
            { x: rx, y: ty },   // 2: 右上
            { x: lx, y: by },   // 3: 左下
          ];
          const wp = waypoints[boss.circleWaypoint % 4];
          const dx = wp.x - boss.x, dy = wp.y - boss.y;
          const dist2 = Math.sqrt(dx * dx + dy * dy);
          const circleSpeed = 5.5;
          if (dist2 < 28) {
            // ウェイポイント到達 → 次へ
            boss.circleWaypoint = (boss.circleWaypoint + 1) % 4;
          } else {
            boss.vx = (dx / dist2) * circleSpeed;
            boss.vy = (dy / dist2) * circleSpeed;
            boss.x += boss.vx * dt;
            boss.y += boss.vy * dt;
          }
        }
        // 画面内クランプ
        boss.x = Math.max(scrollX, Math.min(scrollX + canvas.width - boss.w, boss.x));
        boss.y = Math.max(15, Math.min(canvas.height - boss.h - 10, boss.y));
      } else {
        if (speed > 3.5) boss.animState = 'charge';
        else if (dist < 180 || boss.hp < boss.maxHp * 0.5) boss.animState = 'rage';
        else if (speed > 0.5) boss.animState = 'prowl';
        else boss.animState = 'idle';
        const def = BOSS_ANIM[boss.animState];
        boss.animTimer++;
        if (boss.animTimer >= def.interval) {
          boss.animTimer = 0;
          boss.animFrame = (boss.animFrame + 1) % def.frames.length;
        }
        boss.x += boss.vx * dt;
        if (boss.x < player.x - 100) boss.vx = Math.abs(boss.vx);
        if (boss.x > player.x + 300) boss.vx = -Math.abs(boss.vx);
      }

      if (player.invincible <= 0 && rectOverlap(player.x, player.y, player.w, player.h, boss.x+20, boss.y+20, boss.w-40, boss.h-40)) {
        const playerBottom = player.y + player.h;
        const bossStompThreshold = 28;
        const onBossTop = player.vy >= 0 && playerBottom >= boss.y && playerBottom <= boss.y + bossStompThreshold;
        if (onBossTop) {
          boss.hp -= 2;
          document.getElementById('bossHpBar').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
          player.y = boss.y - player.h;
          player.vy = -12;
          player.vx = player.dir * 5;
          player.isJumping = true;
          player.jumpHeld = true;
          screenShake = 6;
          createParticles(player.x + player.w/2, boss.y, '#ffaa00', 8);
        } else {
          player.hp -= 15;
          player.invincible = 50;
          player.vx = (player.x < boss.x ? -1 : 1) * 14;
          player.vy = -8;
          screenShake = 18;
          createParticles(player.x + player.w/2, player.y + player.h/2, '#ff4757', 15);
        }
      }

      if (boss.hp <= 0) {
        createParticles(boss.x + boss.w/2, boss.y + boss.h/2, '#ffd700', 40);
        createParticles(boss.x + boss.w/2, boss.y + boss.h/2, '#ff6b6b', 30);
        boss = null;
        document.getElementById('bossBarContainer').style.display = 'none';
        showStageInfo('BOSS CLEAR!', 2400);
      }
    }
  }

  // パーティクル
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.15 * dt; p.vx *= Math.pow(0.96, dt); p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // UI
  document.getElementById('hpBar').style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
  document.getElementById('staminaBar').style.width = Math.max(0, player.stamina / player.maxStamina * 100) + '%';

  // ゲームオーバー判定
  if (player.hp <= 0) endGame('GAME OVER', '猫は力尽きた…');
  if (!boss && player.x > STAGE_LENGTH + 400) {
    if (currentStage < 2) initStage(currentStage + 1);
    else endGame('CONGRATULATIONS!', 'すべてのステージをクリアした！');
  }
}

// ============================================================
//  DRAW
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 空のグラデーション（2面は夕暮れ・空中ステージ雰囲気）
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (currentStage === 2) {
    skyGrad.addColorStop(0, '#1a1a3e');
    skyGrad.addColorStop(0.3, '#4a2c6a');
    skyGrad.addColorStop(0.6, '#e07c4a');
    skyGrad.addColorStop(1, '#87ceeb');
  } else {
    skyGrad.addColorStop(0, '#4a90d9');
    skyGrad.addColorStop(1, '#87ceeb');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  if (screenShake > 0.5) ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);

  // 雲（画像があればパララックスで描画、なければ円でフォールバック）
  if (cloudSpriteImg && cloudSpriteImg.complete && cloudSpriteImg.naturalWidth) {
    const cw = Math.min(80, cloudSpriteImg.naturalWidth);
    const ch = Math.min(40, cloudSpriteImg.naturalHeight);
    clouds.forEach(c => {
      const cx = ((c.x - scrollX * 0.15) % (canvas.width + 200)) - 100;
      const s = c.s;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(cloudSpriteImg, cx, c.y - ch * s / 2, cw * s, ch * s);
      ctx.globalAlpha = 1;
    });
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    clouds.forEach(c => {
      const cx = ((c.x - scrollX * 0.15) % (canvas.width + 200)) - 100;
      const s = c.s;
      ctx.beginPath();
      ctx.arc(cx, c.y, 18*s, 0, Math.PI*2);
      ctx.arc(cx+14*s, c.y-6*s, 14*s, 0, Math.PI*2);
      ctx.arc(cx+28*s, c.y, 16*s, 0, Math.PI*2);
      ctx.arc(cx+12*s, c.y+4*s, 12*s, 0, Math.PI*2);
      ctx.fill();
    });
  }

  // 遠景（1面：山 / 2面：遠くの民家シルエット）
  if (currentStage === 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 12; i++) {
      const mx = i * 200 - (scrollX * 0.03) % 200;
      ctx.beginPath();
      ctx.moveTo(mx, GROUND_Y);
      ctx.lineTo(mx + 40, GROUND_Y - 60 - (i % 4) * 15);
      ctx.lineTo(mx + 120, GROUND_Y);
      ctx.fill();
    }
  } else {
  // 1面：遠景の山（画像があればパララックス、なければ多角形）
  if (mountainBgImg && mountainBgImg.complete && mountainBgImg.naturalWidth) {
    const mw = canvas.width + 200;
    const mh = Math.min(200, mountainBgImg.naturalHeight * (mw / mountainBgImg.naturalWidth));
    const offset = (scrollX * 0.04) % mw;
    for (let i = -1; i <= 2; i++) {
      ctx.drawImage(mountainBgImg, -offset + i * mw, GROUND_Y - mh, mw, mh);
    }
  } else {
    ctx.fillStyle = '#5a8a5a';
    for (let i = 0; i < 8; i++) {
      const mx = i * 250 - (scrollX * 0.05) % 250;
      ctx.beginPath();
      ctx.moveTo(mx - 100, GROUND_Y);
      ctx.lineTo(mx + 50, GROUND_Y - 80 - (i%3)*20);
      ctx.lineTo(mx + 200, GROUND_Y);
      ctx.fill();
    }
  }
  }

  ctx.save();
  ctx.translate(-scrollX, 0);

  if (currentStage === 2) {
    // 2面：全足場を雲として描画
    platforms.forEach(pl => {
      const cx = pl.x + pl.w / 2;
      const py = pl.y;
      const pw = pl.w;
      const ph = pl.h;
      ctx.save();
      // 雲の影（うっすら下にオフセット）
      ctx.fillStyle = 'rgba(180,200,230,0.35)';
      ctx.beginPath(); ctx.ellipse(cx + 4, py + ph * 0.95, pw * 0.42, ph * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      // 雲本体（複数の楕円を重ねて綿雲）
      ctx.fillStyle = 'rgba(245,250,255,0.96)';
      ctx.beginPath(); ctx.ellipse(cx,            py + ph * 0.70, pw * 0.44, ph * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - pw * 0.26, py + ph * 0.40, pw * 0.26, ph * 0.48, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + pw * 0.22, py + ph * 0.44, pw * 0.22, ph * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx - pw * 0.06, py + ph * 0.18, pw * 0.30, ph * 0.46, 0, 0, Math.PI * 2); ctx.fill();
      // ハイライト（明るい白）
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath(); ctx.ellipse(cx - pw * 0.08, py + ph * 0.12, pw * 0.14, ph * 0.20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  } else {
  // 1面：地面をタイルで描画（谷部分は描画しない）
  {
    const startCol = Math.floor(scrollX / TILE_SIZE);
    const endCol   = Math.ceil((scrollX + canvas.width) / TILE_SIZE);
    for (let col = startCol; col <= endCol; col++) {
      const tx = col * TILE_SIZE;
      if (!isInPit(tx + TILE_SIZE / 2)) {
        drawTile(TILE.GROUND, tx, GROUND_Y);
        // 地面の下部（土）
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(tx, GROUND_Y + TILE_SIZE, TILE_SIZE, 40);
      }
    }
  }

  // 平台をタイルで描画
  platforms.forEach(pl => {
    const type = pl.tileType || TILE.STONE;
    const cols  = Math.ceil(pl.w / TILE_SIZE);
    for (let i = 0; i < cols; i++) drawTile(type, pl.x + i * TILE_SIZE, pl.y);
  });

  // ジャンプ台をタイルで描画
  jumpPads.forEach(jp => drawTile(TILE.JUMP_PAD, jp.x, jp.y));

  // 動く床をタイルで描画（STONEタイル）
  movingPlatforms.forEach(mp => {
    const cols = Math.ceil(mp.w / TILE_SIZE);
    for (let i = 0; i < cols; i++) drawTile(TILE.STONE, mp.x + i * TILE_SIZE, mp.y);
    // 動いている方向を矢印で示す
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mp.dir > 0 ? '→' : '←', mp.x + mp.w / 2, mp.y + TILE_SIZE / 2);
    ctx.restore();
  });

  // 落ちる床をタイルで描画（落下中はBRICKに切り替わって崩落感）
  fallingPlatforms.forEach(fp => {
    if (fp.y < GROUND_Y + 500) {
      const type = fp.triggered ? TILE.BRICK : TILE.STONE;
      const cols  = Math.ceil(fp.w / TILE_SIZE);
      for (let i = 0; i < cols; i++) drawTile(type, fp.x + i * TILE_SIZE, fp.y);
    }
  });

  // 障害物（1面のみ、画像またはピクセルアート）
  if (currentStage !== 2) {
    obstacles.forEach(ob => {
      const idx = (ob.spriteIdx ?? 0) % Math.max(obstacleSprites.length, 1);
      const sprite = obstacleSprites[idx];
      if (sprite) ctx.drawImage(sprite, ob.x, ob.y, ob.w, ob.h);
    });
  }
  }

  // アイテム（魚：画像があれば使用、浮遊アニメーション）
  if (currentStage !== 2) items.forEach(it => {
    if (it.collected) return;
    const bobY = Math.sin(animTick * 0.08 + it.bobPhase) * 5;
    const sprite = (fishItemImg && fishItemImg.complete && fishItemImg.naturalWidth) ? fishItemImg : fishSprite;
    ctx.drawImage(sprite, it.x, it.y + bobY, it.w, it.h);
    ctx.fillStyle = `rgba(255,215,0,${0.3 + Math.sin(animTick*0.15+it.bobPhase)*0.3})`;
    ctx.fillRect(it.x + it.w/2 - 1, it.y + bobY - 4, 2, 2);
  });

  // 敵描画（2面：カラス・風船・ハチ Canvas描画 / 1面：犬・少年・トラック）
  enemies.forEach(en => {
    if (currentStage === 2 && ['crow','balloon','bee'].includes(en.type)) {
      ctx.save();
      if (en.isBlownAway) {
        ctx.translate(en.x + en.w/2, en.y + en.h/2);
        ctx.rotate(en.blowRot);
        ctx.globalAlpha = 0.7;
      } else {
        ctx.translate(en.x + en.w/2, en.y + en.h/2);
      }
      if (en.type === 'crow')         _drawCrowAtOrigin(ctx, en.w, en.h, animTick, en.glidePhase || 0);
      else if (en.type === 'balloon') _drawBalloonAtOrigin(ctx, en.w, en.h, animTick, en.floatPhase || 0);
      else if (en.type === 'bee')     _drawBeeAtOrigin(ctx, en.w, en.h, animTick, en.zigzagPhase || 0);
      ctx.restore();
      return;
    }
    const spriteFrames = en.type === 'dog' ? dogSpriteFrames : en.type === 'kid' ? kidSpriteFrames : truckSpriteFrames;
    const frames = spriteFrames.length > 0 ? spriteFrames : en.frames;
    const frameIdx = frames.length ? en.animFrame % frames.length : 0;
    if (en.isBlownAway) {
      ctx.save();
      ctx.translate(en.x + en.w/2, en.y + en.h/2);
      ctx.rotate(en.blowRot);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(frames[0], -en.w/2, -en.h/2, en.w, en.h);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(en.x + en.w/2, en.y);
    // 犬：主人公（左側）の方を向く。少年・トラック：左向き（進行方向）
    const facePlayer = en.type === 'dog';
    if (facePlayer) ctx.scale(1, 1); else ctx.scale(-1, 1);
    ctx.drawImage(frames[frameIdx], -en.w/2, 0, en.w, en.h);
    ctx.restore();
  });

  // ボス（1面：サンダーウルフ スプライト / 2面：ワシ Canvas描画）
  if (boss && boss.active) {
    if (boss.stage === 2) {
      // ワシ：Canvas パス描画（中心基準）
      ctx.save();
      ctx.translate(boss.x + boss.w/2, boss.y + boss.h/2);
      // 右に進むときは右向きに反転（デフォルト左向き）
      if (boss.vx > 0) ctx.scale(-1, 1);
      _drawEagleAtOrigin(ctx, boss.w, boss.h, animTick, boss.animState);
      ctx.restore();
    } else {
      // サンダーウルフ：スプライトシート
      const def = BOSS_ANIM[boss.animState];
      const frameIndex = def.frames[boss.animFrame];
      const useWolf = bossSpriteFrames.length > 0 && frameIndex < bossSpriteFrames.length;
      const sprite = useWolf ? bossSpriteFrames[frameIndex] : dogFrames[boss.animFrame % 2];

      ctx.save();
      ctx.translate(boss.x + boss.w/2, boss.y + boss.h);
      if (player.x > boss.x) ctx.scale(-1, 1); else ctx.scale(1, 1);
      if (sprite) {
        ctx.drawImage(sprite, -boss.w/2, -boss.h, boss.w, boss.h);
        if (boss.animState === 'rage' || boss.animState === 'charge') {
          const glow = 0.25 + Math.sin(animTick * 0.2) * 0.1;
          ctx.globalAlpha = glow;
          ctx.shadowColor = '#ff4040';
          ctx.shadowBlur = 20;
          ctx.drawImage(sprite, -boss.w/2, -boss.h, boss.w, boss.h);
        }
      }
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(boss.x + 10, boss.y - 16, boss.w - 20, 8);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(boss.x + 10, boss.y - 16, (boss.w - 20) * Math.max(0, boss.hp / boss.maxHp), 8);
  }

  // プレイヤー（ネコ：生成ピクセルアート2コマのみ）
  ctx.save();
  const blink = player.invincible > 0 && Math.floor(animTick / 3) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.3;
  const drawX = Math.floor(player.x + (player.w - CAT_DRAW_W) / 2);
  const drawY = Math.floor(player.y + player.h - CAT_DRAW_H); // 猫の下辺を敵と同じGROUND_Yに揃える
  if (catSheetLoaded && catSheetImg && catSheetImg.complete && catSheetImg.naturalWidth) {
    ctx.imageSmoothingEnabled = false;
    const frameW = catSheetImg.naturalWidth / CAT_SHEET.cols;
    const frameH = catSheetImg.naturalHeight / CAT_SHEET.rows;

    const rowByState = (st) => {
      if (st === 'walk' || st === 'idle') return 1; // デフォルト・何もしてない時も歩きスプライト
      if (st === 'jump') return 2; // 走行アニメをジャンプ見た目として流用
      return 0; // sit
    };
    const row = rowByState(player.animState);
    const col = player.animFrame % 4;

    const isRunLike = (player.animState === 'jump'); // run行を使う時だけ補正
    const offsetX = isRunLike ? CAT_SHEET.runOffsetX : 0;
    const extendLeft = isRunLike ? CAT_SHEET.runExtendLeft : 0;

    const baseSX = col * frameW;
    const sx = Math.max(0, baseSX - extendLeft);
    const sw = frameW + (baseSX - sx);
    const sy = row * frameH;

    ctx.save();
    if (player.dir < 0) {
      ctx.translate(player.x + player.w / 2, player.y + player.h);
      ctx.scale(-1, 1);
      if (offsetX) ctx.translate(offsetX, 0);
      ctx.drawImage(
        catSheetImg,
        sx, sy, sw, frameH,
        Math.floor(-CAT_DRAW_W / 2), -CAT_DRAW_H,
        CAT_DRAW_W, CAT_DRAW_H
      );
    } else {
      if (offsetX) ctx.translate(offsetX, 0);
      ctx.drawImage(catSheetImg, sx, sy, sw, frameH, drawX, drawY, CAT_DRAW_W, CAT_DRAW_H);
    }
    ctx.restore();
  } else {
    // フォールバック：生成ピクセルアート2コマ
    const f = catFrames[player.animFrame % 2];
    if (player.dir < 0) {
      ctx.translate(player.x + player.w / 2, player.y + player.h);
      ctx.scale(-1, 1);
      ctx.drawImage(f, Math.floor(-CAT_DRAW_W / 2), -CAT_DRAW_H, CAT_DRAW_W, CAT_DRAW_H);
    } else {
      ctx.drawImage(f, drawX, drawY, CAT_DRAW_W, CAT_DRAW_H);
    }
  }
  ctx.restore();

  // 言霊弾（吹き出し）描画
  projectiles.forEach(p => {
    const alpha = Math.min(1, p.life / 15);
    ctx.save();
    ctx.globalAlpha = alpha;

    const bx = p.x - p.w/2, by = p.y - p.h/2;
    const r = 8;

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + p.w - r, by);
    ctx.quadraticCurveTo(bx + p.w, by, bx + p.w, by + r);
    ctx.lineTo(bx + p.w, by + p.h - r);
    ctx.quadraticCurveTo(bx + p.w, by + p.h, bx + p.w - r, by + p.h);
    if (p.vx > 0) {
      ctx.lineTo(bx + 14, by + p.h);
      ctx.lineTo(bx + 4, by + p.h + 8);
      ctx.lineTo(bx + 10, by + p.h);
    } else {
      ctx.lineTo(bx + p.w - 10, by + p.h);
      ctx.lineTo(bx + p.w - 4, by + p.h + 8);
      ctx.lineTo(bx + p.w - 14, by + p.h);
    }
    ctx.lineTo(bx + r, by + p.h);
    ctx.quadraticCurveTo(bx, by + p.h, bx, by + p.h - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 13px "Hiragino Sans","Meiryo",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.text, p.x, p.y);

    ctx.restore();
  });

  // パーティクル
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  });
  ctx.globalAlpha = 1;

  ctx.restore(); // scrollX
  ctx.restore(); // screenShake

  // ステージ進行バー（画面下部）
  const progress = Math.min(1, Math.max(0, player.x / (STAGE_LENGTH + 400)));
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, canvas.height - 4, canvas.width, 4);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(0, canvas.height - 4, canvas.width * progress, 4);

  // 次コトダマHUD（右下、進行バーの上）
  {
    const nextK = KOTODAMA_LIST[nextKotodamaIdx];
    const hudX = canvas.width - 12;
    const hudY = canvas.height - 14;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // 背景
    const label = `NEXT: ${nextK.text}`;
    ctx.font = 'bold 14px "Hiragino Sans","Meiryo",sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(hudX - tw - 10, hudY - 20, tw + 14, 22, 5);
    ctx.fill();
    // テキスト
    ctx.fillStyle = nextK.color;
    ctx.shadowColor = nextK.color;
    ctx.shadowBlur = 6;
    ctx.fillText(label, hudX, hudY);
    ctx.restore();
  }

  // コンボ表示（2コンボ以上で右上に表示、タイムアウト近づくと透明に）
  if (combo >= 2) {
    const alpha = Math.min(1, comboTimer / 30);
    const fontSize = Math.min(28 + combo * 2, 52);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = `bold ${fontSize}px "Hiragino Sans","Meiryo",sans-serif`;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(`${combo} COMBO!`, canvas.width - 16, 16);
    ctx.fillStyle = combo >= 10 ? '#ff4444' : combo >= 5 ? '#ff9900' : '#ffd700';
    ctx.fillText(`${combo} COMBO!`, canvas.width - 16, 16);
    ctx.restore();
  }
}

// ============================================================
//  ゲームオーバー / リスタート
// ============================================================
function endGame(title, sub) {
  gameState = 'over';
  document.getElementById('gameOver').style.display = 'block';
  document.getElementById('resultText').textContent = title;
  document.getElementById('resultSub').textContent = sub || '';
  // スコア表示
  document.getElementById('scoreDisplay').innerHTML =
    `<div class="score-row"><span class="score-label">撃破数</span><span class="score-val">${enemiesDefeated} 匹</span></div>` +
    `<div class="score-row"><span class="score-label">最大コンボ</span><span class="score-val">${maxComboAchieved} COMBO</span></div>` +
    `<div class="score-row"><span class="score-label">クリアステージ</span><span class="score-val">STAGE ${currentStage}</span></div>`;
}

function restartGame() {
  gameState = 'playing';
  combo = 0; comboTimer = 0;
  enemiesDefeated = 0; maxComboAchieved = 0;
  document.getElementById('gameOver').style.display = 'none';
  // 死んだステージから再開（2面で死んだら2面から）
  initStage(currentStage);
}

// ============================================================
//  タイトル画面
// ============================================================
function startGameFromTitle() {
  if (gameState !== 'title') return;
  gameState = 'playing';
  unlockAudio();
  const ts = document.getElementById('titleScreen');
  if (ts) {
    ts.classList.add('hiding');
    ts.addEventListener('animationend', () => ts.remove(), { once: true });
  }
}

document.getElementById('titleScreen').addEventListener('click', startGameFromTitle);
document.getElementById('titleScreen').addEventListener('touchstart', e => { e.preventDefault(); startGameFromTitle(); }, { passive: false });
// キーボード入力でもタイトルを閉じる（既存のキーイベントより前に処理）
window.addEventListener('keydown', e => { if (gameState === 'title') startGameFromTitle(); }, { capture: true });

// ============================================================
//  メインループ
// ============================================================
let lastTimestamp = 0;
function loop(timestamp) {
  // 初回フレームはdtを1.0（60fps相当）として扱う
  const rawDt = lastTimestamp === 0 ? 1000 / 60 : timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  // 60fpsを基準に正規化（dt=1.0が60fps相当）。タブ非アクティブ復帰などの大きなズレは3でクランプ
  const dt = Math.min(rawDt / (1000 / 60), 3);
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initStage(1);
centerJoystick();
requestAnimationFrame(loop);