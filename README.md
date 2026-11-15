# Haven Countdown

An animated, Hack Club Haven themed countdown screen for jam submission night. Open it on the big screen and leave it running.

## Run it

Open `index.html` in a browser. No build step and no install.

```sh
xdg-open index.html     # Linux
open index.html         # macOS
```

## Setup screen

A setup screen appears each time the page opens:

- **Haven location:** "Oxford" uses the custom Oxford logo. Any other city puts its name next to the Haven logo, so any Haven can use this.
- **Submission deadline** and **food boss fight** time. Both use today's date on this computer's clock.
- **Feature switches** for each feature listed below.

Settings are saved in that browser. The faint gear button in the top-right corner reopens the setup screen.

## What it does

- Countdown to the deadline. Red warning flashes build up during the last hour, with a glowing screen edge in the last 30 minutes.
- A "ship it! hack.club/hv" button for the last 90 minutes, plus a hedgehog boat ride.
- The hedgehog does backflips and changes mood: sleepy, then panicking near the deadline, then a party hat when it's over.
- Mini events: a friend says hi, a squirrel steals a slice, leaves spell out "SHIP IT!".
- Food attack, where the slices get flip-kicked away, and a food boss fight at the time you set.
- Jam tip signs.
- Gaming stream breaks: the hedgehog streams original mini games, with chat, a webcam and the countdown along the top.
- A clap meter that uses the mic. The louder the room, the bigger the reactions.

## Preview links

Add flags to the URL to skip the setup screen and trigger things right away. Separate several flags with commas:

| Flag | Shows |
|---|---|
| `#stream` | gaming stream mode |
| `#boss` | the food boss fight |
| `#events` | mini events, back to back |
| `#tips` | tip signs |
| `#food` | food attack |
| `#hype` | clap meter driven by a fake noisy crowd (no mic needed) |

Example: `index.html#stream,hype`

## Files

- `index.html`: the page, styles, countdown, setup screen and most animations
- `stream.js`: gaming stream mode and its mini games
- `assets/`: Haven artwork and font (from haven.hackclub.com), the hedgehog and backgrounds

Haven branding and artwork belong to Hack Club.
