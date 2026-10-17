# piece-forge prompt templates

Fill `{STYLE_BLOCK}` with the user's injected style (1–3 sentences, includes the
accent color/marking), `{FACTION}` with the army variant line. Send prompts in ONE
Gemini chat so the style stays anchored. Keep the capitalized constraint phrases —
they are load-bearing.

## Chat opener + KING (the style anchor — always first)

> {If restyling from an existing anchor image, attach it and start with:
> "The attached image is the KING of a chess army - the style anchor for everything
> in this chat."}
>
> Art style for everything in this chat: {STYLE_BLOCK}. Faction: {FACTION}.
> Everything you generate goes on a SOLID FLAT PURE GREEN background (#00FF00
> chroma key) - never a checkerboard, never a transparency pattern. Keep every
> character fully inside the frame (and inside its cell on sprite sheets).
>
> First piece: the KING - the tallest, most monumental unit of the army: a heavy
> crowned/crested head, both hands resting on the pommel of a massive planted
> two-handed weapon, an immense cloak or equivalent silhouette mass, the faction
> marking prominent on the chest. FRONT-FACING full-body standing portrait, feet
> planted on the ground, no text.

## Idle portraits (one per piece, same chat)

Template:

> Next piece: the {PIECE} - {ROLE_CAST}. FRONT-FACING full-body standing portrait,
> feet planted on the ground, solid green background, no text.

Role casts (re-skin the nouns to fit {STYLE_BLOCK}; keep the invariants):

- `{PIECE_PAWN}`: the smallest, youngest-looking unit; simple rounded headgear
  (no crest), light armor, LEGS CLEARLY VISIBLE, holding a POLEARM vertically in
  one hand and a small shield in the other; faction marking on the chest.
- `{PIECE_ROOK}`: a colossal juggernaut, the WIDEST unit; a MASSIVE defensive
  barrier/shield covering half its body held front and center; flat crenellated
  tower-like top on the head; heaviest armor of the whole army; a huge blunt
  weapon resting on its shoulder; faction marking on the barrier.
- `{PIECE_KNIGHT}`: the only MOUNTED unit - a rider on an armored steed (or the
  style's vehicle equivalent), the mount wearing faction-marked covering, the
  rider holding a LANCE angled upward and a shield. SIDE VIEW facing right, mount
  rearing slightly, both fully inside the frame. (Side view, not front-facing.)
- `{PIECE_BISHOP}`: a gaunt mystic, TALLER AND THINNER than the rest; hooded or
  masked head with no visible face; long robes/coat over the armor; holding a TALL
  STAFF topped with the faction emblem; a ritual accessory hanging from the belt.
- `{PIECE_QUEEN}`: regal and lethal, second-tallest; slender crown/crest framing a
  stern face; ornate elegant armor under a long flowing cloak; wielding ONE great
  elegant blade raised before her; faction marking on the breastplate.

## Action sheets (3 per piece, same chat, right after that piece's idle)

Shared suffix for ALL sheets:

> ...exactly 4 frames arranged 2x2, equal cells, SIDE VIEW facing right,
> {SUBJECT} fully inside each cell - no part may touch or cross the cell borders
> or the image edges; make the figure smaller within the cell if needed.
> Consistent scale, one ground line, solid green background, no text.

Where `{SUBJECT}` = "the whole character INCLUDING THE FULL WEAPON" (or "horse and
rider" for the knight).

### WALK

> Now the {piece}'s WALK CYCLE SPRITE SHEET: 4 frames, FULL BODY walking to the
> right, legs clearly stepping through the classic walk positions (contact, down,
> passing, up), {walk flavor: weapon carried at the side / barrier at the side /
> mount trotting, its legs mid-cycle / robes swaying, staff as walking staff /
> cloak flowing behind}. {shared suffix}

### ATTACK (beats: ready → wind-up → strike → follow-through)

> Now the {piece}'s ATTACK sequence: 4 frames: (1) ready fighting stance,
> (2) wind-up - {weapon drawn back/raised high, body coiled}, (3) the STRIKE -
> {explosive thrust / overhead slam / lance impact at full gallop, mount rearing /
> emblem-staff slam with a burst of energy / lightning lunge at full extension},
> (4) follow-through, recovering. {shared suffix}

### DEATH (beats: struck → stagger → collapse → lying)

> Now the {piece}'s DEATH sequence: 4 frames: (1) struck - recoiling backward,
> weapon slipping from the grip, (2) staggering, {knees buckling / barrier
> cracking / mount stumbling} head dropped, (3) collapsing toward the ground,
> (4) lying dead flat on the ground, weapon fallen beside the body. {shared suffix}

## Second-army variant

Re-run idles (and sheets if the game animates both armies) with {FACTION} swapped,
in a fresh chat anchored by uploading the FIRST army's king: "Generate the OPPOSING
army's {piece}: same world, same style, but {black-faction palette line, e.g.
'blackened/ash armor, the marking in black outlined with the accent color'}."
Save as `black-<piece>.png` and color-prefixed frames (see SKILL.md file contract).
