#!/usr/bin/env python3
"""
Pixel-art loading animation for jibbit.ch: a lit joint with a rising smoke plume.
No third-party deps - PNG / APNG are written by hand with zlib + struct.

Outputs (into OUTDIR):
  joint-loader.png          APNG, 32x56, loops forever
  joint-loader@4x.png       APNG, 128x224 (nearest-neighbour, crisp pixels)
  joint-loader-sheet.png    horizontal spritesheet, 512x56  (16 frames)
  joint-loader-sheet@4x.png horizontal spritesheet, 2048x224
  frames/frame-00.png ...   individual frames, 32x56
  demo.html                 both techniques side by side
"""

import math
import os
import struct
import sys
import zlib

W, H = 32, 56
N = 16                      # frames
FRAME_MS = 70               # ~1.12 s per loop

# ---------------------------------------------------------------- palette
# rolling paper, lit from the upper left
PAPER_RAMP  = ((253, 250, 244), (246, 240, 228), (237, 229, 211),
               (221, 209, 186), (199, 184, 156))
# dubi Aktivkohlefilter (www.dubi.at), not a cigarette filter:
# unbleached kraft-paper tube - desaturated and greyish, NOT the orange-tan of
# a cigarette filter - printed with a black wordmark, capped at the mouth with
# a white ceramic cap whose cross-slot shows as a single dark pixel.
CRUTCH_RAMP = ((188, 170, 142), (158, 138, 110), (128, 108,  84))
CRUTCH_LINE = (104,  86,  66, 255)   # paper/filter junction
DUBI_MARK   = ( 48,  42,  36, 255)   # the black print band
CERAMIC_RAMP = ((246, 246, 243), (231, 231, 226), (208, 208, 201))
CERAMIC_SLOT = ( 74,  70,  64, 255)  # the cross-slot in the cap
EMBER_CORE  = (255, 233, 150, 255)
EMBER_MID   = (255, 146,  36, 255)
EMBER_OUT   = (204,  58,  22, 255)
CHAR        = (110,  66,  40, 255)
CHAR_DARK   = ( 66,  38,  24, 255)
ASH_HI      = (186, 183, 178, 255)
ASH         = (128, 124, 119, 255)
SMOKE_RGB   = (146, 150, 160)   # real gray - must stay visible on a near-white page

# alpha ladder for the smoke - quantising is what keeps it pixel art
SMOKE_STEPS = (0, 44, 84, 128, 172, 212, 245)

# ---------------------------------------------------------------- geometry
# A joint held at an angle: cone-shaped, wide at the burning end, narrowing to
# the brown crutch. The tilt is what stops a lit cone from reading as a torch.
TIP_Y   = 20        # ash point at the burning end
BURN_Y  = 23        # charred paper line right under the cherry
MOUTH_Y = 55        # bottom of the crutch
CRUTCH_TOP = 49
TIP_X   = 19.5      # x of the burning tip
TILT    = 0.25      # px of x gained per px climbed

HW_TIP  = 3.0       # half-width at the burn line
HW_END  = 1.0       # half-width at the mouth

SMOKE_X = TIP_X + TILT * 0.5


def axis_x(y):
    return TIP_X - TILT * (y - TIP_Y)


def half_width(y):
    t = (y - BURN_Y) / float(MOUTH_Y - BURN_Y)
    return HW_TIP + (HW_END - HW_TIP) * max(0.0, min(1.0, t))


def span(y, hw):
    cxf = axis_x(y)
    return (int(math.floor(cxf - hw + 0.5)), int(math.floor(cxf + hw + 0.5)))


def ramp_colour(ramp, x, l, r):
    if r == l:
        return ramp[len(ramp) // 2]
    u = (x - l) / float(r - l)
    return ramp[min(len(ramp) - 1, int(u * (len(ramp) - 0.001)))]


# ---------------------------------------------------------------- canvas
def new_buf():
    return bytearray(W * H * 4)


def put(buf, x, y, rgba):
    """Source-over composite of rgba onto buf."""
    if not (0 <= x < W and 0 <= y < H):
        return
    a = rgba[3]
    if a == 0:
        return
    i = (y * W + x) * 4
    if a == 255:
        buf[i:i + 4] = bytes(rgba)
        return
    da = buf[i + 3]
    sa = a / 255.0
    out_a = sa + (da / 255.0) * (1 - sa)
    if out_a <= 0:
        return
    for c in range(3):
        sc = rgba[c] / 255.0
        dc = buf[i + c] / 255.0
        buf[i + c] = int(round(((sc * sa) + dc * (da / 255.0) * (1 - sa)) / out_a * 255))
    buf[i + 3] = int(round(out_a * 255))


def quantise(a):
    best = 0
    for s in SMOKE_STEPS:
        if abs(s - a) < abs(best - a):
            best = s
    return best


# ---------------------------------------------------------------- drawing
def draw_joint(buf, frame):
    flick = 0.5 + 0.5 * math.sin(2 * math.pi * frame / N)      # loops exactly
    core = tuple(int(round(c * (0.88 + 0.12 * flick))) for c in EMBER_CORE[:3]) + (255,)
    mid  = tuple(int(round(c * (0.90 + 0.10 * flick))) for c in EMBER_MID[:3]) + (255,)

    # --- paper cone -------------------------------------------------
    for y in range(BURN_Y, MOUTH_Y + 1):
        l, r = span(y, half_width(y))
        for x in range(l, r + 1):
            put(buf, x, y, ramp_colour(PAPER_RAMP, x, l, r) + (255,))

    # charred edge just under the cherry, still glowing in the middle
    l, r = span(BURN_Y, HW_TIP)
    for x in range(l, r + 1):
        near = abs(x - (l + r) / 2.0) <= 0.75
        put(buf, x, BURN_Y, EMBER_OUT if near else
                            (CHAR_DARK if x in (l, r) else CHAR))
    l, r = span(BURN_Y + 1, half_width(BURN_Y + 1))
    for x in range(l + 1, r):
        put(buf, x, BURN_Y + 1, (170, 142, 112, 255))

    # --- crutch: dubi Aktivkohlefilter ------------------------------
    # Read from the mouth up, this is: white ceramic cap (with its cross-slot),
    # kraft tube, black print band, kraft tube. Those three tones are the whole
    # signature at this size - the wordmark itself is unrenderable at 3 px wide.
    CAP_TOP  = MOUTH_Y - 1      # ceramic cap occupies the last two rows
    MARK_ROW = MOUTH_Y - 3      # the black printed band

    l, r = span(CRUTCH_TOP - 1, half_width(CRUTCH_TOP - 1))
    for x in range(l, r + 1):
        put(buf, x, CRUTCH_TOP - 1, CRUTCH_LINE)

    for y in range(CRUTCH_TOP, MOUTH_Y + 1):
        l, r = span(y, half_width(y))
        for x in range(l, r + 1):
            if y >= CAP_TOP:
                # bottom row reads brightest so the cap catches the eye
                shade = 1 if y < MOUTH_Y else 0
                put(buf, x, y, CERAMIC_RAMP[shade] + (255,))
            elif y == MARK_ROW:
                put(buf, x, y, DUBI_MARK)
            else:
                put(buf, x, y, ramp_colour(CRUTCH_RAMP, x, l, r) + (255,))

    # rim first, then the slot on top - so a narrow cap keeps its slot
    l, r = span(MOUTH_Y, half_width(MOUTH_Y))
    for x in (l, r):
        put(buf, x, MOUTH_Y, CERAMIC_RAMP[2] + (255,))
    if r - l >= 2:
        # the cross-slot: one dark pixel dead centre of the cap face
        put(buf, int(round((l + r) / 2.0)), MOUTH_Y, CERAMIC_SLOT)

    # --- burning cone: ash point -> cherry -> burn line -------------
    for y, hw, kind in ((TIP_Y, 0.0, "ash"), (TIP_Y + 1, 1.0, "hot"),
                        (TIP_Y + 2, 2.0, "warm")):
        l, r = span(y, hw)
        for x in range(l, r + 1):
            edge = x in (l, r)
            if kind == "ash":
                col = ASH_HI
            elif kind == "hot":
                col = ASH if x == l else core
            else:
                col = mid if edge else core
            put(buf, x, y, col)

    put(buf, int(round(axis_x(TIP_Y - 1))), TIP_Y - 1, (156, 152, 147, 165))

    # soft halo around the cherry
    halo = (255, 130, 46, int(40 + 26 * flick))
    for dy, off in ((1, 2), (2, 3), (3, 4)):
        y = TIP_Y + dy
        cxf = axis_x(y)
        put(buf, int(round(cxf - off)), y, halo)
        put(buf, int(round(cxf + off)), y, halo)


def smoke_alpha(x, y, phase):
    """Alpha of the plume at pixel (x, y) for a given loop phase."""
    base = TIP_Y - 0.5          # rooted in the cherry; draw_joint paints over it
    t = (base - (y + 0.5)) / base                  # 0 at the ember, 1 at the top
    if t <= 0 or t > 1:
        return 0

    total = 0.0
    # two strands: a main plume and a companion that thickens it
    for amp, wl, ph_off, weight, thick in ((6.6, 12.0, 0.00, 1.00, 1.0),
                                           (5.2, 12.0, 0.85, 0.50, 0.8)):
        k = 2 * math.pi / wl
        cx = SMOKE_X + amp * (t ** 1.35) * math.sin(k * y + phase + ph_off)
        r = (0.9 + 3.7 * t) * thick
        d = abs((x + 0.5) - cx)
        if d < r:
            total += weight * (1.0 - (d / r) ** 2)
    if total <= 0:
        return 0

    # puff bands riding up the plume (same phase term -> still loops exactly)
    puff = 0.74 + 0.26 * math.sin(2 * math.pi * y / 8.0 + phase)
    # dense at the ember, dispersing as it climbs
    fade = (1.0 - t ** 1.7) * (0.6 + 0.4 * min(1.0, t * 6))
    return quantise(int(round(min(1.0, total) * fade * puff * 1.45 * 255)))


def render(frame):
    phase = 2 * math.pi * frame / N
    top = TIP_Y
    grid = [[smoke_alpha(x, y, phase) for x in range(W)] for y in range(top)]

    # de-speckle: a lone faint pixel with no lit neighbour reads as noise
    clean = [row[:] for row in grid]
    for y in range(top):
        for x in range(W):
            if not grid[y][x]:
                continue
            nb = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < top and 0 <= xx < W and grid[yy][xx]:
                        nb += 1
            if nb < 2:
                clean[y][x] = 0

    buf = new_buf()
    for y in range(top):
        for x in range(W):
            if clean[y][x]:
                put(buf, x, y, SMOKE_RGB + (clean[y][x],))
    draw_joint(buf, frame)
    return buf


# ---------------------------------------------------------------- preview
RAMP = " .:-=+*#%@"


def ascii_dump(buf, label):
    print(f"--- {label} " + "-" * 30)
    for y in range(H):
        row = []
        for x in range(W):
            i = (y * W + x) * 4
            a = buf[i + 3]
            r, g, b = buf[i], buf[i + 1], buf[i + 2]
            if a < 12:
                row.append(" ")
            elif y < TIP_Y - 1:
                row.append(RAMP[min(9, max(1, a * 9 // 255))])
            elif r > 150 and g > 140 and b > 120:
                row.append("#")
            elif r > 140 and g < 180 and b < 130:
                row.append("B")
            elif r > 180 and g < 200 and b < 120:
                row.append("*")
            else:
                row.append("o")
        print("|" + "".join(row) + "|")


# ---------------------------------------------------------------- png
def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def raw_scanlines(buf, w, h):
    out = bytearray()
    for y in range(h):
        out.append(0)
        out += buf[y * w * 4:(y + 1) * w * 4]
    return bytes(out)


def write_png(path, buf, w, h):
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    data = zlib.compress(raw_scanlines(buf, w, h), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", data))
        f.write(chunk(b"IEND", b""))


def write_apng(path, frames, w, h, delay_ms):
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    seq = 0
    out = [b"\x89PNG\r\n\x1a\n", chunk(b"IHDR", ihdr),
           chunk(b"acTL", struct.pack(">II", len(frames), 0))]
    for i, fb in enumerate(frames):
        fctl = struct.pack(">IIIIIHHBB", seq, w, h, 0, 0, delay_ms, 1000, 0, 0)
        out.append(chunk(b"fcTL", fctl))
        seq += 1
        comp = zlib.compress(raw_scanlines(fb, w, h), 9)
        if i == 0:
            out.append(chunk(b"IDAT", comp))
        else:
            out.append(chunk(b"fdAT", struct.pack(">I", seq) + comp))
            seq += 1
    out.append(chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(b"".join(out))


def scale(buf, w, h, s):
    out = bytearray(w * s * h * s * 4)
    for y in range(h):
        for ry in range(s):
            dy = y * s + ry
            for x in range(w):
                i = (y * w + x) * 4
                px4 = buf[i:i + 4]
                for rx in range(s):
                    j = (dy * w * s + x * s + rx) * 4
                    out[j:j + 4] = px4
    return out


def sheet(frames, w, h):
    tw = w * len(frames)
    out = bytearray(tw * h * 4)
    for n, fb in enumerate(frames):
        ox = n * w
        for y in range(h):
            src = (y * w) * 4
            dst = (y * tw + ox) * 4
            out[dst:dst + w * 4] = fb[src:src + w * 4]
    return out, tw


# ---------------------------------------------------------------- html
DEMO = """<!doctype html>
<meta charset="utf-8">
<title>jibbit &mdash; joint loader</title>
<style>
  body {{ margin:0; min-height:100vh; display:grid; place-items:center;
         gap:2.5rem; font-family:Georgia,serif; background:#fdfdfb; color:#222; }}
  body.dark {{ background:#16150f; color:#eee; }}
  .box {{ display:grid; justify-items:center; gap:.4rem; }}
  .cap {{ font:12px/1 ui-monospace,monospace; opacity:.5; letter-spacing:.08em; }}
  .msg {{ font-style:italic; font-size:1.15rem; }}

  /* --- option A: one <img>, animation baked into the APNG --------- */
  .apng {{ width:{aw}px; height:{ah}px; image-rendering:pixelated; }}

  /* --- option B: spritesheet + CSS steps() ------------------------ */
  .sprite {{
    width:{sw}px; height:{sh}px;
    background-image:url(joint-loader-sheet.png);
    background-repeat:no-repeat;
    background-size:{bw}px {sh}px;
    image-rendering:pixelated;
    animation:puff {dur}s steps({n}) infinite;
  }}
  @keyframes puff {{ to {{ background-position-x:-{bw}px; }} }}
  @media (prefers-reduced-motion:reduce) {{ .sprite {{ animation:none; }} }}
</style>

<div class="box">
  <span class="cap">A &mdash; APNG, single &lt;img&gt; (CSS cannot pause it)</span>
  <img class="apng" src="joint-loader.png" alt="Loading">
  <p class="msg">Loading &ndash; bitte warten&hellip;</p>
</div>

<div class="box">
  <span class="cap">B &mdash; spritesheet + CSS steps() (honours reduced-motion)</span>
  <div class="sprite" role="img" aria-label="Loading"></div>
  <p class="msg">Loading &ndash; please wait&hellip;</p>
</div>

<p class="cap" style="cursor:pointer" onclick="document.body.classList.toggle('dark')">
  click to flip the background &mdash; checks the alpha
</p>
"""


def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else "."
    if "--preview" in sys.argv:
        for i in (0, 4, 8, 12):
            ascii_dump(render(i), f"frame {i}")
        return

    frames = [render(i) for i in range(N)]

    os.makedirs(os.path.join(outdir, "frames"), exist_ok=True)
    for i, fb in enumerate(frames):
        write_png(os.path.join(outdir, "frames", f"frame-{i:02d}.png"), fb, W, H)

    write_apng(os.path.join(outdir, "joint-loader.png"), frames, W, H, FRAME_MS)

    big = [scale(fb, W, H, 4) for fb in frames]
    write_apng(os.path.join(outdir, "joint-loader@4x.png"), big, W * 4, H * 4, FRAME_MS)

    s1, tw1 = sheet(frames, W, H)
    write_png(os.path.join(outdir, "joint-loader-sheet.png"), s1, tw1, H)
    s4, tw4 = sheet(big, W * 4, H * 4)
    write_png(os.path.join(outdir, "joint-loader-sheet@4x.png"), s4, tw4, H * 4)

    css = 3
    with open(os.path.join(outdir, "demo.html"), "w") as f:
        f.write(DEMO.format(aw=W * css, ah=H * css, sw=W * css, sh=H * css,
                            bw=W * N * css, n=N,
                            dur=round(N * FRAME_MS / 1000, 2)))

    for name in sorted(os.listdir(outdir)):
        p = os.path.join(outdir, name)
        if os.path.isfile(p):
            print(f"{name:28} {os.path.getsize(p):>7} B")


if __name__ == "__main__":
    main()
