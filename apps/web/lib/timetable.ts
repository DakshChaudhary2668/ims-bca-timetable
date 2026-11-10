import { createHash } from "node:crypto";
import html from "!!./timetable-source-loader.cjs!../../../references/master-timetable/index.html?timetable-source";
import styles from "!!./timetable-source-loader.cjs!../../../references/master-timetable/styles.css?timetable-source";
import theme from "!!./timetable-source-loader.cjs!../timetable/theme.css?timetable-source";
import clientStyles from "!!./timetable-source-loader.cjs!../timetable/client.css?timetable-source";
import client from "!!./timetable-source-loader.cjs!../timetable/client.js?timetable-source";

export const timetableAssets = {
  "styles.css": {
    body: [styles, theme, clientStyles].join("\n"),
    contentType: "text/css; charset=utf-8",
  },
  "app.js": { body: client, contentType: "text/javascript; charset=utf-8" },
};

const integrity = `sha256-${createHash("sha256").update(client).digest("base64")}`;

export const timetableHtml = html
  .replace('href="styles.css"', 'href="/timetable-assets/styles.css"')
  .replace('<script src="master-resource.js"></script>', "")
  .replace(
    '<script src="app.js"></script>',
    `<script src="/timetable-assets/app.js" integrity="${integrity}"></script>`,
  )
  .replace('href="#overview"', 'href="/"')
  .replace(
    /<nav class="nav"[\s\S]*?<\/nav>/,
    `<nav class="nav" aria-label="Main navigation">
    <a class="nav-item" href="/overview"><span aria-hidden="true">▦</span>Overview</a>
    <a class="nav-item" href="/setup"><span aria-hidden="true">▱</span>Academic setup</a>
    <a class="nav-item active" href="/" aria-current="page"><span aria-hidden="true">▣</span>Timetable builder</a>
    <a class="nav-item" href="/faculty"><span aria-hidden="true">♙</span>Faculty &amp; workload</a>
    <a class="nav-item" href="/subjects"><span aria-hidden="true">▥</span>Subjects &amp; requirements</a>
    <button class="nav-item" type="button" id="dailyButton" aria-pressed="false"><span aria-hidden="true">▤</span>Daily view</button>
  </nav>`,
  )
  .replace(/<div class="sidebar-bottom">.*?<\/aside>/s, "</aside>")
  .replace(
    /<div class="top-actions">.*?<\/header>/s,
    '<div class="top-actions"><button class="outline-button" id="operatorButton" type="button">Operator sign in</button></div></header>',
  )
  .replace(
    '<button class="quiet-button" id="importButton">▤ <span>Master resource</span></button>',
    '<button class="quiet-button" id="legacyButton" hidden>Download browser backup</button>',
  )
  .replace(
    /<section class="toolbar"[\s\S]*?<\/section>/,
    `<section class="toolbar" aria-label="Timetable selections">
    <label class="select-wrap"><span class="sr-only">Academic year</span><select id="year" disabled></select><b aria-hidden="true">⌄</b></label>
    <label class="select-wrap"><span class="sr-only">Programme and semester</span><select id="programme" disabled></select><b aria-hidden="true">⌄</b></label>
    <label class="select-wrap compact"><span class="sr-only" id="scopeLabel">Section</span><select id="section" disabled></select><b aria-hidden="true">⌄</b></label>
    <label class="select-wrap week"><span class="sr-only">Timetable version</span><select id="week" disabled></select><b aria-hidden="true">⌄</b></label>
    <span class="status-pill" id="publishStatus" role="status">Loading…</span>
    <button class="primary-button" id="generateButton" type="button" disabled>Create draft</button>
  </section>`,
  )
  .replace('role="tablist"', 'role="group" aria-label="View timetable by"')
  .replace(
    '<button class="outline-button mobile-filter" id="filterButton">☷ Filters</button>',
    '<button class="outline-button" id="reloadButton" type="button">Reload</button>',
  )
  .replace(
    '<section class="schedule-panel">',
    '<section class="schedule-panel"><p class="schedule-message" id="scheduleMessage" role="status">Loading timetable…</p><div id="dailySchedule" hidden></div>',
  )
  .replace(
    '<table class="schedule" id="scheduleTable">',
    '<table class="schedule" id="scheduleTable" aria-label="Weekly timetable" hidden>',
  )
  .replace(
    /<div class="legend">.*?<\/div>/s,
    '<div class="legend"><span><i class="legend-dot lecture"></i>Teaching session</span><span><i class="legend-dot break"></i>Protected break</span></div>',
  )
  .replace(
    /<aside class="operations-panel">[\s\S]*?<\/aside>/,
    `<aside class="operations-panel">
    <div class="panel-title"><h2>Timetable checks</h2></div>
    <p id="operationMessage">Validation checks run on the server.</p>
    <ul id="issues" aria-live="polite"></ul>
  </aside>`,
  )
  .replace(
    /<section class="details-panel">[\s\S]*?<\/footer>/,
    `<section class="details-panel">
    <div class="details-left"><h2>Timetable details</h2><p id="versionDetails">No version selected.</p></div>
    <button class="outline-button" id="printButton" type="button" disabled>Print / PDF</button>
  </section>
  <footer class="source-note">Drafts save to the academic records server. Daily view shows the selected weekly timetable by weekday.</footer>`,
  )
  .replace(
    '<dialog id="modal">',
    '<dialog id="modal" aria-labelledby="modalTitle">',
  );

export const timetablePolicy = [
  "default-src 'none'",
  `script-src '${integrity}'`,
  "connect-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");
