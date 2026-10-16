# Changelog

Newest first. Each entry lists the changes since the previous push and the output checksum of
`patch_op1.py` for that version. The input is always the original R246 image.

## 2026-10-16 16:30 — op1r 37

Output `b3f7bfc8ce5e8f489a396c2e35368c4dc385056746b06a319526735f8deb1ee6` (all plugins)

### Changed
- **clouds** uses less CPU: about 17 % fewer cycles per block on the OP-1 (350 000 → 290 000), same sound
  (bit-identical output). The diffuser, reverb and gain multiplies no longer go through 64-bit arithmetic.
  Only the plugin file changed: with op1r 34 or newer, reinstalling `clouds` from the web patcher is enough.
- Boot screen version: `op1r 37`.

## 2026-10-16 12:45 — op1r 36

Output `42748a37992148e1e9c2b35d5f235818df568d6089a4522c9cc332e9c8b2ea2d` (all plugins)

### Changed
- **drum+ is a plugin file** (`drumplus`, selectable in the web patcher, installed / removed without a firmware update).
  Without it drum+ kits play as normal kits and keep their drum+ settings, which come back with the plugin. Install
  the whole firmware (with the plugins), not only `OP1_vdk.ldr`, or drum+ is missing.
- The hidden **Lander** game (synth + drum + tape + mixer) is removed: its screen and physics world are no longer
  built at start-up, about 190 KB more free memory and a slightly shorter start-up.
- Boot screen version: `op1r 36`.

## 2026-10-16 12:00 — op1r 35

Output `478934c300c14f0941c4eaeecc9caad33e5e4b8938ff90450edb69d0b448da8b` (all plugins)

### Added
- **MIDI sequencer** (opt-in on clock + T2, green **MIDI SEQ**, off by default): SEQ + TAPE opens a 4-track MIDI
  recorder synced to the tape (position, play / stop, loop, tape markers). Per track input (keyboard, stock
  sequencers, USB MIDI channel) and output (instrument, stock sequencer, USB MIDI channel); REC held / latched
  recording of notes and CCs; scissors selection, lift (Shift: all tracks, playhead jumps to the first note), drop.
  One song file; while off, SEQ + TAPE is stock and the sequencer does no work.
  From stop, REC held or Shift + REC waits for the first note, which starts the tape (recording stays on until
  STOP); REC held + metronome counts in first. Quantize (Shift + blue: off, 1/4 … 1/32, 1/8T, 1/16T, one grid
  per song): a take snaps when it ends, Shift + blue press quantizes the selection. Idea by **ultralazr**, thanks!
- **Sequencers as plugin files**: euclid, dots, oracle and peal are plugins now (selectable in the web patcher,
  installed / removed without a firmware update). A sound whose sequencer plugin is missing loads with the pattern
  sequencer instead of stopping the OP-1.
- **MIDI CC synth automation** of the current synth slot (absolute, stored in the sound like a knob turn): CC 53–56
  engine knobs, 57–60 envelope, 72–75 FX knobs, 76–79 LFO knobs. Recorded CCs in the MIDI recorder play back into them
  on tracks with output I (output S ignores CCs, output M sends them out).

### Fixed
- A sound with a missing effect or an LFO the OP-1 doesn't know stopped it at start-up ("Invalid synth patch …
  error 22 / 25"); such a sound now loads with the filter / tremolo, switched off.
- drum+: switching a pad back to gate saved a value the OP-1's own check rejects, so the kit stopped the OP-1 at the
  next start ("Invalid drum patch … error 12"). Gate is now saved with a value it accepts, and kits saved with the bug
  load again, still on gate.
- MIDI recorder: after switching from the recorder to the sequencer page the white encoder and REC kept going to
  the recorder.
- MIDI recorder: with the loop on, the loop start stays in memory (no reload at the wrap).
- MIDI recorder: the loop start marker stays visible when the loop is off (as on the tape screen).
- **"Bad" storage growing** in the FILE box: while recording, the tape save wrote audio that was still changing,
  YAFFS's read-back check then failed and retired a good flash block. Saves now go through a copy, so no more good
  blocks are marked bad (blocks already marked stay bad).
- **Quad LFO** kept running (and moving its sliders) while the LFO was switched off; it now does nothing until it is
  switched on again.

### Changed
- Boot screen version: `op1r 35`.

## 2026-10-15 14:51 — op1r 34

Output `49ce1f5977a0690f0dac42896d3c853c33023a0bf09b3a1bd70cfa58ab6df195` (all plugins)

### Added
- **Synths and effects are plugin files** (`plugins/<name>.op1p`), loaded by the firmware at boot: supersaw, fmbell,
  granular, mixtur, arc, aether, tape, clouds, reverb, palme, in a room. They keep their numbers, so existing sounds
  still use them. Sounds find a plugin by name, so they also work after it was removed and installed again.
- Web patcher: choose which synths / effects go into the firmware file; **Connect OP-1** (op1r 34 or newer) lists the
  installed ones and installs / removes them over USB MIDI without a firmware file. Own plugin files (`.op1p`) can be
  added (only from people you trust). The list shows each plugin's author (`author` in `plugin.json`, stored in the
  plugin file).
- `patch_op1.py --plugins a,b|all|none` (replaces `--without`); `op1push.py --list` / `--delete` (op1r-src).
- Safety: if a boot with plugins does not reach the UI, the next boot skips all plugins once.

### Fixed
- A sound whose effect no longer exists loads as filter instead of locking the OP-1 at boot.
- SysEx update: creating the staging folder could fail (wrong `mkdir` entry); `op1push.py --files OP1_vdk.ldr` now
  also sends the synth / FX list (`op1_factory.db`).

### Changed
- Boot screen version: `op1r 34`.

## 2026-10-15 11:15 — op1r 33

Output `64c7f9ddd96ed5a5111fe6caa289734a65af8819294aaf0c947ef3dcf0ecc1a0`

### Added
- Synth engine **aether**: a tilt theremin using the OP-1's motion sensor. The key sets the note; tilting forward /
  back bends the pitch, raising the right side fades the volume, shaking adds vibrato. Blue pitch range (1–24
  semitones), green timbre, white vibrato, red volume tilt; presses: dead zone, tilt for the full range, vibrato
  rate (a dot under the bar). Mono / legato / portamento: the stock play modes.

### Fixed
- SysEx update (web and `op1push.py`): your sampler slots, settings and tape (`drum_N.raw`, `synth_N.raw`,
  `op1.db`, `tape.db`) are never sent; the synth / FX list (`op1_factory.db`) is always sent with a new firmware.

### Changed
- Boot screen version: `op1r 33`.

## 2026-10-15 09:30 — op1r 32

Output `87ad2ccb3b65cc41cde2f1aff6d841bb30555bfdf36c081d887c9d0ca8c4a215`

### Added
- Web patcher: **Update over USB (SysEx)** button when a connected OP-1 runs op1r with SysEx update (Chrome / Edge,
  Web MIDI). Sends only the files that differ; the OP-1 asks before anything is applied (T1 restart, T2 cancel).
- SysEx update: the OP-1 reports file sizes and its firmware version, so only changed files are sent
  (`op1push.py --force` sends everything).

### Changed
- Security: while the update prompt is shown, MIDI key events (CC control) are ignored: only a physical T1 press
  confirms. The prompt shows **NEW FIRMWARE** when the main firmware is replaced.
- Boot screen version: `op1r 32`.

## 2026-10-14 20:45 — op1r 31

Output `b79949491d19ec803d71f9e76d154689556669d4af8f000ec96d39834484e180`

### Added
- Synth engines **mixtur** (Mixtur-Trautonium subharmonic organ) and **arc** (Duddell's singing arc); FX **palme**
  (Ondes Martenot diffuseur) and **in a room** (Lucier's *I am sitting in a room*) (ultralazr).
- Sequencers **oracle** (geomantic shield chart) and **peal** (change ringing) (ultralazr).
- Firmware update over USB MIDI SysEx (`tools/op1push.py` in op1r-src): files are staged while the OP-1 runs and
  applied after a restart (T1 restart, T2 cancel); the boot area is never written.

### Changed
- Plugin tables indexed by order, gaps allowed (plugins/ORDERS.md) (Hundekraft).
- supersaw, fmbell: output 6 dB lower so chords don't clip the synth bus (Hundekraft).
- drum+: the type browser opens on DRUM+ for drum+ slots, user kits open on DRUM.
- Boot screen version: `op1r 31`.

## 2026-10-14 08:20 — op1r 30

Output `047d37d46fb98c81a871018efd834872fb56a047972dcf62e1816e96205aeada`

### Added
- **drum+**: a second drum instrument on the same kit (sample, pad regions). In drum mode, Shift + T1 → **DRUM+**
  keeps the current kit and adds per-pad sound design; choosing a kit or DBOX returns to the stock drum.
  - **T1 play**: blue pitch (stock) / Shift fine tune / press reverse; green pitch envelope / Shift glide time /
    press playmode (gate, one-shot, loop); white retrig 2–8 hits / Shift rate (1/8 … 1/64, tempo-synced) / press
    choke group 1–4; red drive / Shift volume (stock) / press mono.
  - **T2 envelope and tone**: blue attack / Shift velocity → pitch / press envelope on-off; green decay / Shift
    humanize (random start and level) / press linear-exp; white release / Shift resonance / press filter (LP, HP,
    BP); red cutoff / Shift velocity → cutoff / press velocity → start.
  - The pages draw the pad's waveform with the envelope, pitch envelope, retrig hits and filter over it.
  - Settings are stored in the kit (`"op1r"` key of the drum patch); a stock OP-1 loads such a kit as a normal drum.
    Pads without settings sound exactly as the stock drum.
  - CPU: a fully loaded drum+ voice costs about 3× a stock drum voice (stock render reused). The resource monitor
    (clock mode, T1) shows `drum+ x stock y` (% of the audio time) while drums play.

### Changed
- Boot screen version: `op1r 30`.

### Known
- Reopening the type browser on a drum+ slot highlights DRUM (not DRUM+).

## 2026-10-13 22:08 — op1r 29

Output `e660df64cb42140dfc032b9a05c504ac4d8214a5e8b5e7f436ff6e1dc694814c`

### Added
- **Sample editor: loop points.** The sampler's loop points are shown in the editor; a blue press switches blue /
  green from start / end to the loop points (drawn in blue / green while edited). They stay inside start..end and
  move along with trims, cuts and pastes.

### Fixed
- **Crackle with the quad LFO and heavy FX** (e.g. reverb plus a big delay): the quad LFO redid all its decoding
  for every voice on every audio block. It now decodes only when an encoder changes a value and advances its
  shared LFOs once per block. LFO-to-LFO modulation of a shared LFO can react one block (about 3 ms) later.
  Patch and hardware test by a user, thank you.

### Changed
- Boot screen version: `op1r 29`.

## 2026-10-13 21:16 — op1r 28 (web patcher fix)

Output unchanged (`b9a7739ffa9a1530e1032902e934d0905cdf6697480d4b6e726244819fd36a1b`).

### Fixed
- **Web patcher**: failed with `No known package with name 'sqlite3'` (built into Pyodide 314, no separate
  package anymore).

## 2026-10-13 20:30 — op1r 28

Output `b9a7739ffa9a1530e1032902e934d0905cdf6697480d4b6e726244819fd36a1b`

### Added
- **Sample editor**: red = volume (gain −60..+24 dB, saturating), Shift + red = scroll, or with transient mode on
  the transient sensitivity 1–7 (shown as `tr N`). Exponential fade curve (T3 cycles linear / power / exp).
  Sampler loop points are shown (display only).
- **Drum auto-cut**: equal mode — blue sets the number of slices (1–24, default 24); hits mode shows the
  sensitivity on the T2 label.

### Changed
- **Faster tape erase**: only the parts of the tape file that hold clips are cleared, not the whole 124 MB file.
- Boot screen version: `op1r 28`.

## 2026-10-13 16:02 — op1r 27

Output `bc3249bc56fd64ddb1a635e551a85595250781bee6b7eef563e2732e5645c07f`

### Fixed
- **Saves failing with "out of memory"** (dots, euclid, and the stock sequencer saves with many user presets): the
  firmware's database cache grew until its fixed memory was full, and from then on every save failed (with dots:
  the crash reported for op1r 18–25). The cache is now capped when the databases open. Analysis and fix by a user,
  thank you.
- Correction to op1r 26: its crash explanation (stack overwritten) was wrong; the crash came from the firmware's
  error report walking our code's stack frames. op1r 26's change still prevents it.

### Changed
- The firmware code block is smaller and ends below 0x01E40000 (its zeroed variables moved to a separate area), so
  it can coexist with other projects' modules loaded there.
- Boot screen version: `op1r 27`.

### Added
- **Source code published:** [op1r-src](https://github.com/pcppcp/op1r-src) (GPL-3.0-or-later), including
  the synth SDK and a guide for writing your own synth / effect plugins.
- **Choose your synths and FX**: `patch_op1.py --without clouds,granular` (or unticking them in the web patcher)
  hides custom synths / FX from the OP-1's selection lists. Their code stays in, so presets that use them still
  work. `--info` lists the names.

## 2026-10-13 14:31 — op1r 26

Output `60475eac4079ac1b07ea174ad87c8aeabed0bd3e72c56229df053d9a2a60ea4c`

### Fixed
- **Crash when the dots sequencer saves** (reported: Shift + white on dots, exception screen, op1r 18–25): when the
  database rejected the save, the firmware's error report copied the whole ~7 KB statement into a small stack buffer
  and crashed. Long saves (dots, euclid, tape markers) now go to sqlite directly and an error is just returned.
  If a save fails, the resource monitor (clock + T1) shows `db err N` (please include N in a report).

### Changed
- Boot screen version: `op1r 26`.

## 2026-10-13 14:09 — op1r 25

Output `12922293a255cb6952605149d24b7fd8d09b19ecc2177984b02d79405e45c79e`

### Added
- **Drum sample editor** (drum + scissors on the drum page): edits the last played pad's region (exact to the
  sample), zooms to it when a key is pressed; `fit` (trim the pad's silence), zero / normalize / reverse / DC / fade,
  copy, cut (zeroes), paste (overwrites).
- **Auto-cut** of a drum sample into pads (Shift + T3): the first 24 hits or 24 equal slices, preview, sensitivity on
  blue, undo with Shift + left.
- **Play position** line in the sample editors.

### Changed
- Transient detection stricter (fewer hits inside one sound).
- Boot screen version: `op1r 25`.

## 2026-10-13 13:19 — op1r 24

Output `9f73dec61fae7fb0c156ad7f0dbf2a10284fedc1e291e60544b6c5f6d5c6470f`

### Added
- **Sample editor** for the synth sampler (synth + scissors on the sampler page): start / end markers, zoom,
  scroll, zero-crossing and transient snap, trim (with undo and de-click fades), zero, normalize, reverse, DC offset,
  fades (in / out / both, linear / equal power), attenuation of the whole sample, copy / cut / paste of the
  selection through the stock clipboard (to the tape, a sampler slot or back into the editor). Key labels above
  T1–T4 in the stock font, Shift shows the alternate ones.

### Changed
- **Kali reverb**: green and red swapped: green = tone, red = mix; tone dial green, mix scale and title red.
  Reverbs saved before this version load with mix and tone exchanged.
- Boot screen version: `op1r 24`.

## 2026-10-13 07:03 — op1r 23

Output `d98805a53404ac7fe77ed23117028db133ac78a76ad50fddbc850cfd9d81ccae`

### Added
- **Punch in / out at markers**: tape held + REC arms punch mode (red markers, `[o]` around the record circle). The
  next marker in the travel direction (forward or reverse, also across the loop wrap) punches in, the next one
  punches out, then punch mode turns off. PLAY while punched in: 1st press ends punch mode (still recording), 2nd
  press stops recording; STOP stops; STOP while armed and stopped disarms; tape + REC again cancels.
- **License**: GPL-3.0-or-later with an additional permission to combine with the OP-1 firmware (LICENSE, NOTICE).

### Changed
- Boot screen version: `op1r 23`.

## 2026-10-12 23:34 — op1r 22

Output `5b20c4e874597b68f9b4d67ecceab8546e4746b468173bb621909aeb1a0db559`

### Added
- **Count-in before recording**: REC held + metronome (tape stopped) counts 4 / 8 / 16 beats with the stock
  metronome click, then starts recording on the next beat, hands-free until STOP. STOP or REC + metronome again
  cancels. Uses a fixed audible level if the metronome level is 0. Requested by users.
- **Settings page** on the clock / card screen, **T3**: COUNT-IN 4 / 8 / 16 (blue), saved.

### Changed
- **Metronome accent**: beat 1 of each 4/4 bar is an octave higher, also for the normal metronome. Bars follow the
  tape position (from the tape start, or from where a count-in recording started).
- Boot screen version: `op1r 22`.

## 2026-10-12 22:35 — op1r 21

Output `359e5d022882a5673efca2c957f32241bc9b997b2a573f58caeaba835e2bbf66`

### Added
- **Oblique Strategies cards** on Shift + help: a random card (never the same twice in a row) in the clock's place;
  Shift + help toggles card / clock, the last view is remembered; T1 / T2 still open the monitor / USB out page.
  Text in the OP-1 font; `' ( ) [ ]`, which the font lacks, are drawn separately. Idea and cards from
  ultralazr/op1-oblique-strategies (MIT; card texts by Brian Eno and Peter Schmidt).

### Changed
- Shift + help in clock mode switches between card and clock (stock: did nothing).
- Boot screen version: `op1r 21`.

## 2026-10-12 21:55 — op1r 20

Output `a5a719e8e8de936f9191628c2f9765c5b3a7f54772044e3778dfb8f780345be3`

### Added
- **Tape markers**: tape screen, red press sets a marker at the cursor, Shift + red press removes the one under the
  cursor, Shift + red turn jumps to the next / previous marker (wraps, also while playing). Up to 32, green ticks
  above the tracks that scroll and zoom with the tape, saved. Plain red still sets the record level.

### Changed
- Shift + red on the tape screen no longer changes the record level (it jumps between markers).
- Boot screen version: `op1r 20`.

## 2026-10-12 20:59 — op1r 19

Output `dbbf0a66c16903681dc2851b5444a69bd22a65bf92842baa9449cf6459a754e1`

### Added
- **USB track outs**: USB audio to the computer has 6 channels: main L/R (1–2) and tape tracks 1–4 (3–6),
  pre-fader, following tape speed and reverse, gap-free across the loop point.
- **USB out page**: clock screen (Shift + help), then **T2**; blue switches MASTER / MASTER + TRACKS at once, saved.
  MASTER (default) silences the track channels and saves 5–7 % CPU.

### Changed
- USB audio input is now 6 channels instead of 2 (a DAW sees main L/R on inputs 1–2 as before). Disk mode and MIDI
  are unchanged.
- Boot screen version: `op1r 19`.

## 2026-10-12 15:32 — op1r 18

Output `ca667abb81f458f6039d9959383a0ecce56f34f8fb6e811392f0c787affb894a`

### Added
- dots: **FX parameter locks.** Each trigger can set the instrument FX knobs 1–4 (FX1–FX4 in the white parameter
  list, `--` = off by default, 0–100 %); the knob returns to its own setting after the step's gate (TIE: at the slot's
  next trigger). Requested by a user.
- dots: **lock triggers** without a note: press blue while recording on an empty step (hollow square), again to
  remove it; a note key on it adds a note and keeps the locks.

### Fixed
- A synth patch whose type is unknown (a custom engine no longer in the firmware) locked the OP-1 with
  "patch.cpp:390 Invalid synth patch … error 1"; it now loads as the stock iter synth.

### Changed
- Boot screen version: `op1r 18`.

## 2026-10-12 14:17 — op1r 17

Output `118e6fe845d4d66cb400d7d65da76438a739d4a2031f8efc3ddb48a7423a6be1`

### Added
- **Resource monitor**: clock screen (Shift + help), then **T1**: CPU (total, from the idle time), audio (time spent
  in audio processing, with a peak marker), RAM (both heaps), disk (used / total) and the MIDI in / out buffer fill
  (peak, %). T1 again returns to the clock.

### Changed
- quad LFO: an LFO can no longer target itself (white skips its own F / A / O). With one target per LFO a self
  target had no audible effect; such stored targets are ignored.
- Boot screen version: `op1r 17`.

## 2026-10-12 11:23 — op1r 16

Output `7d49979e0e01927281898b9a0fcc49d09633650cb427b1bf15961113a77e67df`

### Added
- quad LFO: **LFOs as targets.** White now also reaches LFO 1–4's frequency (F, ±2 octaves), amount (A, ×0…2) and
  phase offset (O, ±½ cycle); an LFO can modulate itself. Several LFOs on one target add up.

### Changed
- quad LFO: new saved format. **Quad LFOs saved with op1r 15 or earlier load silent** (all four LFOs at defaults,
  amount 0) and have to be set up again; the first edit converts them.
- Boot screen version: `op1r 16`.

## 2026-10-12 10:40 — op1r 15

Output `b356970c524a00997b99529f56c4fd2c98370b554c2947dc3a2ba3fee9e2e81a`

### Fixed
- **MIDI sync to an external sequencer** (user report). With tempo sync = MIDI in, the OP-1's sequencers ignored MIDI
  START: a running pattern kept its own position, so the OP-1 played up to 3 clocks (≈ 60 ms at 120 bpm) early or
  late, different on every start. Now MIDI START restarts the stock pattern sequencer, dots and euclid so their first
  step falls on the master's first clock, also after a pause (when the OP-1 had fallen back to its internal tempo).
  Measured at 60 / 120 / 200 bpm: every note 1.0 ± 0.4 ms after the master's grid. Other stock sequencers (endless,
  arpeggio, finger, sketch, tombola) are unchanged.
- dots / euclid: steps fired one tick early (1/96 beat with the internal tempo, almost a clock with an external clock).

### Changed
- Boot screen version: `op1r 15`.

## 2026-10-11 22:45 — op1r 14

Output `297cac31ab66780fcb5f9e30c3772247b5cdba100d1b7da8b6d8831845eeb1a1`

### Added
- reverb: **own screen** with the Kali artwork instead of the generic FX screen. Blue (time) shows 1–6 arms,
  green (mix) lights the mix scale from the bottom, white (diffusion) brightens the skull necklace, red (tone) fades
  in the fire ring and flames; the TIME / DIFFUSION / TONE needles follow their knobs.

### Changed
- Boot screen version: `op1r 14`.

## 2026-10-11 22:01 — op1r 13

Output `a0b657bc2a8df53c3ee1513538f23774ed83e59809a65ee987e639b660525dbc`

### Added
- quad LFO: **LFO types** on red: VOIC (per voice), FREE, GATE (restarts at note-on), MONO (restarts at every note-on,
  shared), SHOT (one cycle, then holds), RAND (random value per note). Requested by a user (gate mode).
- quad LFO: **phase offset** (Shift + blue, 45° steps).

### Changed
- quad LFO: new screen, one row per LFO with output, frequency, amount, target (symbol + knob colour dot, drum icon
  on the drum page) and type. White now selects the target directly (12 targets, wraps); red selects the type.
- quad LFO: frequency and amount have 64 steps each (as the encoder steps before); patches with older quad LFOs load
  unchanged and switch to the new format when edited.
- Boot screen version: `op1r 13`.

## 2026-10-11 17:35 — op1r 12

Output `d294dcb3f419848cec66b57bc7f587ea86fd40e03ddd4fe726492804d6a28f2c`

### Added
- dots: **trigger parameters**, edited with white while recording (press white to switch between value and
  parameter): gate 5–100 % or tie, ratchet 1–8, chance 0–100 %, condition (ALL, 1:2 … 4:4), nudge ±12/96 beat,
  ratchet level ramp (off / up / down). New triggers start with defaults; recording over a trigger only changes
  its note.
- dots: **live recording**. The OP-1 REC key switches recording on / off on the dots screen (it no longer arms the
  tape there); pressing red switches the type between REC (step record) and LIVE. LIVE records keys at the playhead
  of the running slot, hard quantised, with the gate from the key hold time (longer than a step = tie); while the
  slot is stopped it records at the cursor.

### Changed
- dots: record mode is no longer toggled by pressing red (REC key instead); `REC` / `LIVE` moved to the top right.
- dots: saved data now includes the trigger parameters; patterns saved with op1r 11 still load.
- Boot screen version: `op1r 12`.

## 2026-10-11 15:29 — op1r 11

Output `b43716c5df59c5eeedfa4b6687bbd2a05945f46fc89955bec91e2bd65ca716f3`

### Added
- **dots** step sequencer (first iteration): 6 slots playing together, up to 64 steps each, shown as rows of
  16 dots. Blue cursor, Shift + white slot, red start/stop, Shift + red / Shift + C# start/stop all. Record mode
  (press red): keys add triggers at the cursor step by step, red = trigger level, Shift + blue erases, green length
  ±1, Shift + green extends to the next full row copying the row above. Mutes, 4 patterns, copy / paste / cut and
  saving as in euclid. Step rate (1/16) and gate are fixed for now.

### Changed
- Boot screen version: `op1r 11`.

## 2026-10-11 11:28 — op1r 10

Output `a3b0b6478dac3398a8fc0bb370aaf41f86e519116c869e63da7e2bd010984758`

### Added
- **MIDI CC control** (USB MIDI, OP-1 MIDI channel):
  - all front-panel keys except the keyboard: CC = key code + 5 (the OP-1 CTRL mode numbering), value ≥ 64 = press,
    < 64 = release, so combinations like REC + PLAY or Shift + key work. Transport: CC 38 REC, 39 PLAY, 40 STOP
  - the four encoders as relative CCs 102–105 (1–63 up, 65–127 down)
  - mixer: CC 106–109 track volume, 110–113 track pan (64 = centre), 114–117 track mute; CC 118 tape input level
  - CC 1–4 still go to the MIDI LFO; encoder presses are not mapped (CC 64 is the sustain pedal)

### Changed
- Boot screen version: `op1r 10`.
- `build_patch.py` refuses local builds (build time on the boot screen); build with `make_firmware.py --opz --release`.

## 2026-10-11 09:20 — op1r 9

Output `6057c2258b75741a69611b6f52cc577279e48be3fcbd3af025ccdc46cc2b64cd`

### Fixed
- quad LFO settings, custom FX page-2 values (clouds pitch, dry/wet, reverb) and the granular sample gain are now
  written into the instrument's patch, so they are saved with it. (Picking another LFO / FX / engine type still
  loads that type's defaults, as on the stock OP-1.)

### Changed
- Boot screen version: `op1r 9`.

## 2026-10-11 08:35 — op1r 8

Output `794934277973cd8a8ad9a3b2ec3f51149a6e15284dfac34793536f487d4da90a`

### Added
- quad LFO: **Shift page** with a table of all four LFOs. Blue frequency (Hz) or tempo division, green smoothing
  (0–7), white waveform (sine, triangle, ramp up, ramp down, square, sample & hold), red tempo sync on/off
  (4/1, 2/1, 1/1, 1/2, 1/4, 1/4T, 1/8, 1/8T, 1/16, 1/16T, 1/32).
- Patches saved with earlier versions keep their LFO frequencies (sine, free, no smoothing).

### Changed
- Boot screen version: `op1r 8`.

## 2026-10-10 21:18 — op1r 7

Output `ce6405cfe24c8f9fea06df67a13477fb51f1e6d247a2405b807dd49bbf88174c`

### Added
- granular: the **input** key opens "keyboard to sample" on a granular slot like on the sampler; the recording goes
  into the slot's sample buffer and is saved. The slot stays granular with its knobs (no switch to the sampler).
- granular: **red press** toggles page 2 = sample gain (0–4×, default 1×), stored per slot; the red dial gets a ring
  and shows the gain.

### Changed
- Boot screen version: `op1r 7`.

## 2026-10-10 20:43 — op1r 6

Output `1acdf3f18d1d2ea5e169b6428530ffec0dd8348844e3e0e934f0ec2b81a95bc1`

### Added
- Euclid: **level per slot** (note velocity 1–127, default 100) on page 2 of the red encoder, stored per pattern and
  saved. Always shown as a red bar at the right border (dim above the level); a triangle marks red page 2.
- Euclid: **lift / drop / scissors** on the euclid screen copy / paste / cut the selected slot; with **Shift** the whole
  pattern. Running slots keep running.
- Custom synth engines (supersaw, fmbell, granular) follow note velocity (euclid level, MIDI in).

### Changed
- Boot screen version: `op1r 6`.

## 2026-10-10 18:44 — op1r 5

Output `d4daaea0b7af55f58be545008346f8f54a11abd652945721084b0a6876ab717d`

### Added
- Euclid patterns: 4 per synth/drum, recalled with **Shift + F G A B** (any screen, also the tape view). Each
  pattern stores note, steps, pulses, rotation, rate, gate, octave and mute of all 6 slots and is saved. Switching
  is immediate; playing slots stay in time. P1–P4 is shown at the bottom left of the euclid screen.

### Changed
- Euclid: which slots are playing is global across patterns. Shift + red / Shift + C# start all six slots; a slot
  without a note in the current pattern runs silently and plays when a pattern with a note there is recalled.
- Euclid screen: the red play/stop row is gone; a playing slot shows a red dot in the centre of the big ring
  (and of its small ring, also when it has no note).
- Euclid settings saved by earlier versions load into pattern 1.
- Boot screen version: `op1r 5`.

## 2026-10-10 17:34 — op1r 4

Output `6747a7d67133990d690ac40dd5544c2484812d71fde0f0b7c2a72b4f78fc5213`

### Added
- Euclid: **Shift + C#** starts all slots at once, or stops all if any is running (any screen).
- Euclid: holding **REC** (tape armed) while Shift + C# starts the slots also starts the tape, like REC + PLAY, so
  the recording begins with the first step.

### Changed
- Boot screen version: `op1r 4`.

## 2026-10-10 16:27 — op1r 3

Output `b07eadec568f457325381007fadf0b12c2d74f5873c7307bb04a20832a989c8a`

### Added
- **reverb** FX: port of the Mutable Instruments Elements reverb (MIT, © Emilie Gillet), on instruments and as
  master FX. Blue time (decay, up to near-infinite), green mix, white diffusion, red tone (damping, dark to
  bright). Generic FX screen.

### Changed
- Boot screen version: `op1r 3`.

## 2026-10-10 15:28 — op1r 2

Output `6dfdb643b2c8337304e2ff226e0c50f6b77aa20a56c5f815b3ffee6d1a5ea40e`

### Added
- Euclid quick mute: Shift + G A B C D E (the last six white keys) mutes/unmutes slots 1–6, Shift + D# mutes or
  unmutes all. A muted slot keeps running (playhead moves, green dots dimmed) but plays no notes. Works from any
  screen while the sequencer is on.
- Euclid settings are saved: note, steps, pulses, rotation, rate, gate, octave and mute of every slot, plus the
  selected slot, per synth/drum. Saved in the background like the stock sequencers; slots come back stopped.

### Changed
- Boot screen version: `op1r 2`.

## 2026-10-10 14:15 — op1r 1

Output `4e037a342db27244ad4db863ded47e023e893e210d1ed42634824a08cda5ac69`

### Added
- Version number on the boot screen: `op1r 1` under the TE logo (replaces `R. 00246`).
- Animated **lab screen for the stock iter synth** (graphic `iter-lab.svg` from op1repacker, MIT License,
  © 2016 op1hacks). The gauges follow the knobs. Bubble speed follows the blue knob and the falling dashes the red
  knob. Bubbles, the flame (brighter with the volume), voice dots and the last played note react to playing.
  The pipes are brighter than in the original graphic.
- Quad LFO on drums: the envelope target now modulates the drum envelope.

### Fixed
- Quad LFO on drums: engine knob targets had no effect. They were applied in the drum envelope pass instead of the
  per-voice pass.

## 2026-10-10 10:30

Output `a8bc18bc27fa35ae08c42f0eccf33a8d582c7c5fea218f0d02d5aeb158aeaccf`

### Added
- **euclid** sequencer: an extra entry in the sequencer list (finger and the other stock sequencers are unchanged),
  for synth and drums.
  - 6 slots per mode, each a euclidean rhythm on one note. Shift + white selects the slot; a note key pressed on the
    euclid screen assigns its note at the current octave (later octave changes keep the slot's pitch, also on drums).
  - Encoders: steps, pulses, rotation (clockwise), red start/stop; Shift + red starts/stops all slots with a note.
    Encoder presses switch blue/green/white to rate, gate and octave.
  - Locked to the OP-1 tempo clock, polyphonic, sends MIDI notes. The left/right buttons change the keyboard octave
    as usual. Settings are live only (not saved yet).

## 2026-10-10 08:10 — v1.0

Output `b720d371722f1c48850358dc5eebba13602155e142f5f2ea30480389d4caf557`

### Added
- Quad LFO modulates **drums**: on the drum page, the synth target moves the drum engine knobs and the fx target
  moves the drum FX knobs, just like on the synth. Synth and drum LFOs run independently.

### Changed
- Drum page: the white encoder skips the envelope targets (drums have no envelope to modulate). Voice-mode LFOs
  on drums advance every block, so they behave like free-running ones.

## 2026-10-10 07:45

Output `c19c52e44440ef5b6930fbfab4a1f718e1f3e76db7e591e89ddf19dc92254926`

### Added
- Custom FX (tape, clouds) work as **master FX** in the mixer. The effect processes the mono sum and is added to
  both channels, so the dry stereo image is kept. Master and instrument instances keep separate state, so the
  same FX can run on an instrument and on the master at the same time.

### Fixed
- Selecting the filter as master FX while an instrument used a custom FX showed the instrument's FX screen,
  and the master ran the plain filter instead of the custom FX.

### Changed
- README: feature list rewritten (how to use tape, clouds and quad LFO); this changelog added.

## 2026-10-09 20:46

Output `138b6aa6a2e5ef055825b0160f5d42dd9a298a92d49609ce3b949a9e0a3f47cc`

### Added
- **clouds** granular FX (port of Mutable Instruments Clouds) with its own screen. Encoder presses switch to a
  second page; the red press freezes.
- **quad** LFO: four LFOs in one slot (frequency, amount, target, destination), full-screen page. Press an
  encoder to select LFO 1–4.
  - Targets: synth knob, envelope A/D/S/R, FX knob.
  - Each LFO runs per **voice** or **free-running** (white dot).

### Fixed
- "patch.cpp:390 Invalid synth patch … error 27" when loading patches that use the quad LFO.
- Quad LFO with FX targets had no effect.
- Tape echo screen synced to the audio clock. Wow depth increased.

## 2026-10-09 12:56

Output `c7031a7b1ad801e2b32a1d9c805802000641f5691a93ce302323a7952234d2bf`

### Fixed
- Tape echo could store a knob value outside the allowed range, which locked up the OP-1 ("Instr fx param out
  of range") on every boot. Bad stored values are now repaired automatically.

## 2026-10-09 11:58 — initial release

- Custom synth engines with their own screens: supersaw (chainsaw), fmbell (bell), granular.
- Tape echo FX with its own screen.
- Hidden OP-Z controller mode in COM → CTRL (SysEx `F0 00 20 76 00 01 03 F7` on, `… 00 F7` off).
- Patcher: checksum-verified, deterministic repack, contains no Teenage Engineering firmware.
