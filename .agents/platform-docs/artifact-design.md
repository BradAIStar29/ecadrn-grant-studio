# artifact-design

> How to design an artifact (dashboard, report, comparison, itinerary, timeline, explainer, calculator) so it looks editorial, clean and modern. Activate before creating, rewriting or restyling one.

An artifact is one finished page the user keeps, shares and opens on a phone. Build it from the artifact kit below: write
<main class="a-page" data-look="NAME"> and the kit's stylesheet, fonts, light and dark themes and phone layout are added
for you when it is saved through the `artifacts` tool. Write a fragment: no <html>, <head>, <body>, no Tailwind classes,
no colours or fonts of your own. Never paste the markup into chat.

THE FEEL. Editorial, like a feature in a well-designed magazine or an annual report: a very large bold headline, one
enormous number or chart that carries the story, thin rules instead of boxes, small tracked capitals for labels and one
strong accent colour on a deep, coloured ground. Confident and spare. It must never look like a dashboard of cards.

PLAN FIRST. Before writing, decide:
- The shape. Let the content choose it, and do not default to a dashboard. A question about a number is a short brief:
  a few sentences, the two or three figures that matter, one small chart. A plan is a timeline or a list. A comparison
  is one table. A piece of writing is a narrow page of text. Only something the user will monitor is a dashboard.
- The title: a short, plain name for the page, six words at most, set very large ("Europe's population, 2026").
  Wrap the one word or figure that matters in <em>. The takeaway goes in the lede, in one or two sentences.
- The hero: the single number or chart that carries the page. It sits directly under the header at great size.
- What to leave out. Three to five blocks is a page. Every extra number, card or chart makes the rest harder to read.
End with a one-line footer giving the source and period.

LOOK. Choose data-look from the topic, and keep it for the same user's related pages:
- forest (default): deep green with coral in dark mode, cream paper with coral in light. Choose it when unsure.
- ember: warm black with vermilion. Reports, business, culture, food.
- ink: neutral black and white with blue. Product, software, anything technical.
- navy: deep navy with amber. Finance, data, operations, travel.
- lime: black with acid lime. Sport, engineering, bold statements.
If the user names a brand colour, keep the closest look and set style="--a-seed:#HEX;--a-glow:#HEX" on the <main>
(seed is the accent on the light page, glow the accent on the dark one; use a lighter tint of the colour for glow).

PARTS. These classes carry the type, spacing, colour and both themes. Compose them; do not restyle them.
- Page: a-page (add `narrow` for a text-led page, `wide` only for a dense dashboard). Direct children are the page's
  blocks, spaced for you.
- Header: a-head > a-eyebrow (source or period, set in small capitals under a heavy rule), a-title, a-lede.
- Hero: <section class="a-hero"> > a-label, a-value (rendered enormous, in the accent colour; wrap the unit in
  <small>), an optional a-delta, and an optional chart with its a-axis. One per page.
- Layout: a-stats (a row of two to four key numbers), a-grid (equal columns; style="--min:260px" sets the minimum
  width), a-split (two columns; add `wide` for 2:1), a-section (an h2 plus its content), a-row (inline items; add
  a-between to push them apart), a-stack (tight vertical group).
- Group: a-card is a group under a thin rule, not a box. Start it with an <h3> or an a-label. Variants: `accent` (a
  heavy accent rule and an accent number: one per page at most), `flat` (no rule), `soft` (a tinted block, only for
  the inputs of a calculator or tool).
- Number: a-label, a-value (wrap a unit in <small>), a-delta with `up` or `down` (the arrow is added; up is green
  and down is red, so where a rise is bad, as with churn or cost, add `bad`, and where a fall is good add `good`).
- Text: h2 and h3 (bold section headings), h4 (a small-capitals label), p, a-note (small), a-quote (one large
  statement), a-callout (the conclusion or recommendation, set large under an accent rule; start it with a
  <b> label), a-list (ul, ruled rows), <dl class="a-kv"> (dt and dd pairs with short values),
  a-chip (a small tag; use rarely).
- Table: <div class="a-scroll"><table class="a-table">; class="num" on numeric cells and their headers;
  class="best" on the row to notice. Keep it to the columns that matter, five at most.
- Bars: a-bars > <div class="a-bar" style="--v:72"><span>Label</span><b>$1.6M</b><i></i></div>. --v is 0-100. Sort by
  value. Add `dim` to every bar but the one the page is about.
- Columns: <div class="a-cols"> > <div style="--v:64" class="hot"><b>64</b><span>Mon</span></div> for up to about 12
  periods; `hot` marks the column that matters.
- Share: <div class="a-donut" style="--v:68"><b>68%</b></div> for a single share of a whole.
- Line or area: <svg class="a-chart" viewBox="0 0 600 200" preserveAspectRatio="none"> holding <line class="grid">,
  <path class="area">, <path class="line"> (a second series: `line b2`; a target or last year: `line dim`). Put no text
  inside the SVG: follow it with <div class="a-axis"><span>Apr</span>...</div> for the x labels, and name the series in
  an a-legend only when there is more than one. Compute the path from the real values, y inverted, leaving 10px of
  headroom. One or two grid lines are enough.
- Sequence: <ol class="a-timeline"> > <li><span class="a-time">Oct 6</span><b>Title</b><span class="a-note">Detail</span></li>.
  The time sits in a left column, so keep it short ("Oct 6", "Day 2", "2019").
- Controls: a-seg > <button aria-pressed="true|false"> (switch a view or filter), a-btn (add `ghost`), a-input,
  <input type="range">. Add a control only when the user needs to change what is shown; it must work: toggle `hidden`
  on blocks or recompute the numbers in a short inline <script>. No dead buttons, no fake navigation.
Anything the parts cannot express (a diagram, a map of steps, a custom chart) goes in your own small <style>, built only
from the kit's variables so it follows the look and both themes: --a-bg, --a-surface, --a-fg, --a-muted, --a-faint,
--a-line, --a-wash, --a-accent, --a-accent2, --a-soft, --a-soft2, --a-on-accent, --a-good, --a-bad, --a-radius,
--a-display, --a-body. Never write a hex colour, a font name or a media query for dark mode.

CRAFT.
- Scale is the design. One thing is huge (the title, then the hero); everything else is small and quiet. Do not make
  several things medium-sized.
- Rules, not boxes. Groups are separated by thin rules and space. Never draw a row of bordered or filled cards.
- One accent. The look's colour marks the hero, the bar or line the page is about and the conclusion. Everything else
  is ink on paper. Green and red appear only on a change that is good or bad.
- No decoration: no emoji, no icons, no badges, no gradients, no rainbow of categories.
- Space: leave it. A short page with room around each block is finished.
- Words: plain and few. Labels are two or three words. Headings name the thing ("Largest countries"), and a sentence
  under them says what to notice. Numbers carry units and are rounded to what matters ($1.84M, not $1,843,221.57).
- Vary the page with its content. Two pages on different subjects should not have the same skeleton.
- Honesty: use the real data from the conversation and say its source and period in the footer. With no data, build the
  page on clearly labelled sample figures and say so in the footer. Never invent a metric and present it as real.
- Phone: the kit reflows by itself. Do not set fixed widths or heights in pixels on layout elements.

EXAMPLE (one possible shape; choose the shape your content needs)
<main class="a-page" data-look="forest">
  <header class="a-head">
    <div class="a-eyebrow">Eurostat · 1 January 2026</div>
    <h1 class="a-title">Europe's population, <em>2026</em></h1>
    <p class="a-lede">Slightly below the 2020 peak. Deaths outnumber births, and migration keeps the total steady.</p>
  </header>
  <section class="a-hero">
    <span class="a-label">People in Europe</span>
    <div class="a-value">744<small>M</small></div>
    <span class="a-delta down">1M since 2020</span>
    <svg class="a-chart" viewBox="0 0 600 120" preserveAspectRatio="none" style="--h:120px" role="img" aria-label="Population rose from 727M in 2000 to 745M in 2020, then eased to 744M">
      <path class="area" d="M0,96 L150,70 L300,40 L450,14 L600,20 L600,120 L0,120 Z"/>
      <path class="line" d="M0,96 L150,70 L300,40 L450,14 L600,20"/>
    </svg>
    <div class="a-axis"><span>2000</span><span>2010</span><span>2020</span><span>2026</span></div>
  </section>
  <section class="a-stats">
    <div class="a-card"><span class="a-label">EU-27</span><div class="a-value">452<small>M</small></div><span class="a-delta up">1.0M in a year</span></div>
    <div class="a-card"><span class="a-label">Median age</span><div class="a-value">44.9<small>yrs</small></div></div>
  </section>
  <section class="a-card">
    <h3>Largest countries</h3>
    <div class="a-bars">
      <div class="a-bar" style="--v:100"><span>Russia</span><b>144M</b><i></i></div>
      <div class="a-bar dim" style="--v:58"><span>Germany</span><b>83.6M</b><i></i></div>
    </div>
  </section>
  <div class="a-callout"><b>What to notice</b><p>The east and south are shrinking while the north and west hold steady.</p></div>
  <footer class="a-foot">Sources: UN World Population Prospects, Eurostat. Rounded estimates.</footer>
</main>

Keep artifacts portable to public sharing: embed data, CSS and JavaScript.
External libraries/styles may load only from: https://cdnjs.cloudflare.com/ajax/libs/ https://cdn.jsdelivr.net/npm/ https://cdn.tailwindcss.com https://code.jquery.com/ https://unpkg.com/
External images may load only from Wix Media: https://media.base44.com/images/public/ https://static.wixstatic.com/media/
External audio/video may load only from: https://media.base44.com/videos/public/ https://media.base44.com/files/public/ https://video.wixstatic.com/video/
Google Fonts stylesheets (https://fonts.googleapis.com/) and fonts from https://fonts.gstatic.com/ https://media.base44.com/files/public/ work.
Use existing/provided asset URLs; never invent Wix Media URLs. Embed other images as data URIs.
Use inline SVG for charts/icons. No remote data requests, nested frames or workers.

EDITING. To change an existing artifact, read its file first. Then:
- A small change (a number, a sentence, one block): edit the file in place. Its html starts with a
  <style data-artifact-kit> block, which is the kit: leave it exactly as it is.
- A redesign, a restyle or a rewrite of most of the page, or any page that has no such block: call the `artifacts`
  tool with command "rewrite", the file as `path` and the full new fragment (without the style block). The same
  artifact and its share link are updated and the current kit is added. Never write a kit page with bash: without the
  kit's stylesheet it renders as plain unstyled text.
- An artifact embedded in a longer document (text around the fence): the tool cannot rewrite it. Edit only that
  fence in place and keep everything around it.

Before saving, check: the title is short and set large; there is one hero and no row of boxes;
every number has a unit and a source; every control changes something; there are no colours, fonts or pixel widths of
your own.
