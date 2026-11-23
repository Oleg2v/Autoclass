// Generic sedan, side view, facing LEFT (front of the car = left = "forward" in RTL reading).
// No real make/model: proportions are deliberately generic.
// Every morphable shape has a `damaged` and a `restored` variant with IDENTICAL command
// structure, so the runtime can interpolate the numbers linearly (no MorphSVG needed).
// viewBox: 0 0 1000 400, ground line at y = 362.

export const VIEW = { w: 1000, h: 400, ground: 362 };
export const WHEELS = [
  { id: 'front', cx: 236, cy: 298, r: 64 },
  { id: 'rear', cx: 764, cy: 298, r: 64 },
];
export const ARCH_R = 77;
export const ROCKER_Y = 330;

// Outer silhouette of the body (counter-clockwise from the nose).
export const body = {
  restored:
    'M 66 266 C 64 244 74 228 94 222 C 180 206 262 198 344 192 C 386 162 428 139 472 130 C 540 120 606 119 656 127 C 708 141 758 160 804 177 C 846 181 884 185 910 191 C 928 201 940 222 940 246 C 940 274 936 304 926 330 L 834 330 A 77 77 0 1 0 694 330 L 306 330 A 77 77 0 1 0 166 330 L 98 328 C 80 320 68 300 66 266 Z',
  damaged:
    'M 92 278 C 88 256 100 240 116 234 C 168 212 236 218 344 194 C 386 163 428 140 472 131 C 540 121 606 120 656 128 C 708 142 758 161 804 178 C 846 182 884 186 910 192 C 928 202 940 223 940 247 C 940 275 936 305 926 330 L 834 330 A 77 77 0 1 0 694 330 L 306 330 A 77 77 0 1 0 166 330 L 106 338 C 96 332 90 312 92 278 Z',
};

// Shoulder line highlight (kinked when damaged).
export const shoulder = {
  restored: 'M 104 240 C 160 234 230 230 300 226 C 420 218 520 212 700 208 C 800 205 870 206 932 216',
  damaged: 'M 122 252 C 190 228 236 248 300 224 C 420 218 520 212 700 208 C 800 205 870 206 932 216',
};

// Lower body crease.
export const rocker = {
  restored: 'M 312 306 C 420 304 560 304 694 306',
  damaged: 'M 312 306 C 380 318 470 296 694 306',
};

// Crumple creases (zig-zag when damaged, flat when restored, then fade).
export const creases = [
  {
    restored: 'M 150 242 L 176 242 L 202 242 L 228 242 L 254 242',
    damaged: 'M 150 246 L 176 230 L 202 252 L 228 234 L 254 250',
  },
  {
    restored: 'M 378 258 L 404 258 L 430 258 L 456 258 L 482 258',
    damaged: 'M 378 244 L 404 268 L 430 248 L 456 276 L 482 258',
  },
  {
    restored: 'M 398 290 L 422 290 L 446 290 L 470 290',
    damaged: 'M 398 280 L 422 298 L 446 284 L 470 300',
  },
];

// Dents: soft dark hollows with a lit rim (radial gradients).
export const dents = [
  { cx: 214, cy: 246, rx: 52, ry: 22, rot: -8 },
  { cx: 432, cy: 268, rx: 72, ry: 30, rot: 4 },
  { cx: 116, cy: 294, rx: 34, ry: 16, rot: 0 },
];

// Scratches across the front door (drawn out = repaired).
export const scratches = [
  'M 364 280 C 404 272 454 268 524 272',
  'M 384 296 C 424 290 474 288 514 292',
  'M 492 240 C 506 244 526 250 546 256',
];

// Glass area (dark tint), B-pillar, reflection.
export const glass =
  'M 362 194 C 400 168 436 149 474 141 C 538 132 598 132 638 136 C 686 148 728 163 768 181 C 650 185 505 190 362 194 Z';
export const pillarB = 'M 572 134 L 585 134 L 581 189 L 567 190 Z';
export const glassReflect = 'M 428 172 C 460 154 494 144 528 140 L 506 189 L 448 191 Z';
export const glassTopLine = 'M 380 186 C 416 160 452 146 490 140 C 560 132 620 133 650 140';

export const doorSeams = {
  front: 'M 350 198 C 345 240 344 290 349 330',
  middle: 'M 574 192 C 577 240 575 290 570 330',
  rear: 'M 752 186 C 744 206 734 226 722 246',
};

export const handles = [
  { x: 478, y: 226, w: 34, h: 7 },
  { x: 682, y: 222, w: 34, h: 7 },
];

export const mirror = 'M 352 190 C 360 175 382 172 395 178 C 393 189 382 195 366 197 Z';

export const headlight = {
  restored: 'M 82 232 C 112 226 152 221 188 218 L 182 234 C 150 238 116 243 86 250 Z',
  damaged: 'M 106 244 C 128 236 160 229 190 224 L 184 238 C 154 242 126 248 108 256 Z',
};
export const headlightCracks = 'M 130 240 L 142 250 L 154 236 M 142 250 L 148 256 M 162 234 L 168 244';
export const taillight = 'M 906 198 C 920 204 932 212 938 222 L 936 240 C 924 234 912 230 902 228 Z';

export const intake = {
  restored: 'M 72 292 C 92 296 116 300 150 306 L 150 318 C 118 316 94 312 80 308 Z',
  damaged: 'M 98 302 C 114 308 132 312 154 316 L 152 328 C 130 326 114 322 104 318 Z',
};

export const sill = 'M 306 322 L 694 322 L 694 333 L 306 333 Z';

// Hotspots shown during inspection (viewBox units; HTML labels are positioned in %).
export const hotspots = [
  { id: 'bumper', x: 104, y: 294 },
  { id: 'light', x: 150, y: 238 },
  { id: 'fender', x: 214, y: 246 },
  { id: 'door', x: 432, y: 268 },
];
