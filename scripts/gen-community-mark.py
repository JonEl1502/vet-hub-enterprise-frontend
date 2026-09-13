# -*- coding: utf-8 -*-
"""
Generates the four VetHubCore Community assets from one shape library, so the
wordmark and the icon can never drift apart by hand-editing one of them.
"""
import io, os

DEFS = '''  <defs>
    <!-- COW — fattest cleaves, barely splayed. -->
    <g id="cow">
      <path d="M-1.1 -6.3 C-3.9 -6.3 -5.7 -3.1 -5.7 .6 C-5.7 4.3 -3.9 6.4 -2 6.4 C-.9 6.4 -.7 4.6 -.7 2.2 L-.7 -5.2 C-.7 -6 -.8 -6.3 -1.1 -6.3 Z"/>
      <path d="M1.1 -6.3 C3.9 -6.3 5.7 -3.1 5.7 .6 C5.7 4.3 3.9 6.4 2 6.4 C.9 6.4 .7 4.6 .7 2.2 L.7 -5.2 C.7 -6 .8 -6.3 1.1 -6.3 Z"/>
    </g>
    <!-- GOAT — narrower, longer, splayed at the toe. The splay is the only
         cue that separates goat from sheep once this is reduced. -->
    <g id="goat">
      <path transform="rotate(-9)" d="M-.9 -6.8 C-3.1 -6.2 -4.5 -2.7 -4.3 1.1 C-4.1 4.5 -2.6 6.1 -1.2 5.7 C-.4 5.5 -.5 3.9 -.6 1.8 L-.9 -5.5 C-.95 -6.3 -.75 -6.85 -.9 -6.8 Z"/>
      <path transform="rotate(9)" d="M.9 -6.8 C3.1 -6.2 4.5 -2.7 4.3 1.1 C4.1 4.5 2.6 6.1 1.2 5.7 C.4 5.5 .5 3.9 .6 1.8 L.9 -5.5 C.95 -6.3 .75 -6.85 .9 -6.8 Z"/>
    </g>
    <!-- SHEEP — shortest, bluntest, cleaves held tight. -->
    <g id="sheep">
      <path d="M-.85 -5 C-3.3 -5 -4.9 -2.4 -4.9 .8 C-4.9 3.9 -3.3 5.4 -1.7 5.4 C-.8 5.4 -.6 3.9 -.6 1.9 L-.6 -4.1 C-.6 -4.8 -.7 -5 -.85 -5 Z"/>
      <path d="M.85 -5 C3.3 -5 4.9 -2.4 4.9 .8 C4.9 3.9 3.3 5.4 1.7 5.4 C.8 5.4 .6 3.9 .6 1.9 L.6 -4.1 C.6 -4.8 .7 -5 .85 -5 Z"/>
    </g>
    <!-- CHICKEN — three toes forward, one back. STROKED, not filled: a bird
         track is a line drawing and fills to a blob at this size. Expand these
         strokes to paths before any print run. -->
    <g id="chicken" fill="none" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 1.7 L0 -6.9"/><path d="M0 1.7 L-5.3 -4.3"/>
      <path d="M0 1.7 L5.3 -4.3"/><path d="M0 1.7 L0 6.7"/>
    </g>
    <!-- PAW — the house mark's own paw, reduced. -->
    <g id="paw">
      <ellipse cx="-3.6" cy="-4.2" rx="1.9" ry="2.4"/>
      <ellipse cx=".9" cy="-5.6" rx="1.9" ry="2.5"/>
      <ellipse cx="5" cy="-3.6" rx="1.8" ry="2.3" transform="rotate(16 5 -3.6)"/>
      <ellipse cx="-7" cy="-.2" rx="1.7" ry="2.1" transform="rotate(-24 -7 -.2)"/>
      <path d="M-.8 -1.4 C3 -1.4 5.9 1.2 5.9 4.1 C5.9 7.1 3 8.4 -.8 8.4 C-4.6 8.4 -7.5 7.1 -7.5 4.1 C-7.5 1.2 -4.6 -1.4 -.8 -1.4 Z"/>
    </g>
  </defs>'''

LETTERS = '''    <g fill="none" stroke="#F2A41C" stroke-width="17" stroke-linecap="round">
      <path d="M 92 34.8 A 44 44 0 1 0 92 85.2"/>
      <circle cx="160" cy="60" r="38"/>
    </g>'''

# FULL — four prints in the C, two paws in the o.
# The prints sit LEFT of the C's mouth: that bowl opens on the right, and
# anything near the gap reads as escaping the letter rather than living in it.
FULL = LETTERS + '''
    <g fill="#F2A41C">
      <use href="#cow" transform="translate(52,41.5) rotate(-14)"/>
      <use href="#goat" transform="translate(37,59) rotate(-62)"/>
      <use href="#sheep" transform="translate(51,77) rotate(12)"/>
      <use href="#chicken" transform="translate(67,60) rotate(24)" stroke="#F2A41C"/>
      <use href="#paw" transform="translate(153,52) rotate(-16) scale(.95)"/>
      <use href="#paw" transform="translate(168,69) rotate(18) scale(.85)"/>
    </g>'''

# SMALL — two prints and one paw. Four objects inside one counter is simply
# too many below ~140px; this is the same idea drawn at a scale that survives.
SMALL = LETTERS + '''
    <g fill="#F2A41C">
      <use href="#cow" transform="translate(47,48) rotate(-12) scale(1.5)"/>
      <use href="#chicken" transform="translate(64,70) rotate(18) scale(1.5)" stroke="#F2A41C" stroke-width="1.2"/>
      <use href="#paw" transform="translate(160,60) scale(1.9)"/>
    </g>'''

def wordmark(ink, note):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 232" role="img" aria-label="VetHubCore Community"><title>VetHubCore Community</title>
  <!-- {note}
       One shared "Co": read across it says VetHubCore, read down it says
       Community. Four tiny tracks walk inside the C — cow, goat, sheep and a
       chicken foot — and two paws sit inside the o.
       Outline the text to paths and expand the chicken's strokes before print. -->
{DEFS}
  <g transform="translate(242,45.8) scale(1.086)">
{FULL}
  </g>
  <g font-family="'Hanken Grotesk','Inter',Helvetica,Arial,sans-serif" font-weight="800" font-size="64" letter-spacing="-1" fill="{ink}">
    <text x="239" y="92" text-anchor="end">VetHub</text>
    <text x="473" y="92" text-anchor="start">re</text>
    <text x="473" y="176" text-anchor="start">mmunity</text>
  </g>
</svg>
'''

def icon(tile):
    rect = f'<rect width="128" height="128" rx="30" fill="{tile}"/>\n  ' if tile else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="VetHubCore Community"><title>VetHubCore Community</title>
  <!-- The shared glyphs alone, for where the wordmark cannot go.
       TWO prints, not four: below ~140px four objects in one counter become
       texture rather than animals. Cow and chicken are the two silhouettes
       that stay distinct from each other longest.
       Legible to about 48px. NOT a favicon — it silts up at 32px. -->
{DEFS}
  {rect}<g transform="translate(14.3,35.6) scale(.473)">
{SMALL}
  </g>
</svg>
'''

files = {
  'public/vethubcore-community-wordmark.svg':       wordmark('#FFFFFF', 'White wordmark — for pine and other dark grounds.'),
  'public/vethubcore-community-wordmark-light.svg': wordmark('#12312A', 'Pine wordmark — for white and other light grounds.'),
  'public/vethubcore-community-icon.svg':           icon('#0B241E'),
  'public/vethubcore-community-icon-bare.svg':      icon(None),
}
for path, body in files.items():
    with io.open(path, 'w', encoding='utf-8') as f:
        f.write(body)
    print('wrote %-52s %5d bytes' % (path, len(body.encode('utf-8'))))
