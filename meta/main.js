import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// GitHub repo that commit links point to
const REPO_URL = 'https://github.com/moza-ucsd/portfolio';

// Shared state. xScale / yScale are declared up here (not inside
// renderScatterPlot) so isCommitSelected() can use them too (Step 5.4).
let data = [];
let commits = [];
let xScale;
let yScale;

// ---------------------------------------------------------------------------
// Step 1.1: read loc.csv
// ---------------------------------------------------------------------------
async function loadData() {
  // Everything in a CSV is a string, so convert numbers and dates ourselves.
  return d3.csv(new URL('loc.csv', import.meta.url).href, (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
}

// ---------------------------------------------------------------------------
// Step 1.2: one object per commit (the CSV has one row per LINE of code)
// ---------------------------------------------------------------------------
function processCommits(data) {
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
    // All lines in a commit share the same author, date, etc.
    const first = lines[0];
    const { author, date, time, timezone, datetime } = first;

    const ret = {
      id: commit,
      url: `${REPO_URL}/commit/${commit}`,
      author,
      date,
      time,
      timezone,
      datetime,
      // time of day as a decimal, e.g. 2:30 PM = 14.5
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      // how many lines this commit touched
      totalLines: lines.length,
    };

    // Keep the raw lines, but hide them so console.log(commit) stays readable
    Object.defineProperty(ret, 'lines', {
      value: lines,
      configurable: true,
      writable: true,
      enumerable: false,
    });

    return ret;
  });
}

// ---------------------------------------------------------------------------
// Step 1.3: summary stats
// ---------------------------------------------------------------------------
function periodOfDay(date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  const stat = (label, value) => {
    dl.append('dt').html(label);
    dl.append('dd').text(value);
  };

  // Total lines of code and commits
  stat('Total <abbr title="Lines of code">LOC</abbr>', data.length);
  stat('Total commits', commits.length);

  // Number of distinct files
  stat('Files', d3.group(data, (d) => d.file).size);

  // Grouped aggregate: longest line number per file, then the mean across files
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  stat('Avg file length', d3.format('.1f')(d3.mean(fileLengths, (d) => d[1])));

  // Aggregate over the whole dataset
  stat('Longest line (chars)', d3.max(data, (d) => d.length));

  // Min/max value: the group with the most work
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => periodOfDay(d.datetime),
  );
  stat('Busiest time of day', d3.greatest(workByPeriod, (d) => d[1])?.[0]);
}

// ---------------------------------------------------------------------------
// Step 3: tooltip
// ---------------------------------------------------------------------------
function renderTooltipContent(commit) {
  if (!commit || Object.keys(commit).length === 0) return;

  const link = document.getElementById('commit-link');
  link.href = commit.url;
  link.textContent = commit.id;

  document.getElementById('commit-date').textContent = commit.datetime.toLocaleString('en', {
    dateStyle: 'full',
  });
  document.getElementById('commit-time').textContent = commit.datetime.toLocaleString('en', {
    timeStyle: 'short',
  });
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  const pad = 12; // keeps the tooltip off the cursor so the dot isn't "left"

  // Keep it inside the window so it never gets cut off at an edge
  const x = Math.min(event.clientX + pad, window.innerWidth - tooltip.offsetWidth - pad);
  const y = Math.min(event.clientY + pad, window.innerHeight - tooltip.offsetHeight - pad);

  tooltip.style.left = `${Math.max(pad, x)}px`;
  tooltip.style.top = `${Math.max(pad, y)}px`;
}

// ---------------------------------------------------------------------------
// Step 5: brushing
// ---------------------------------------------------------------------------
function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];

  document.querySelector('#selection-count').textContent = `${
    selectedCommits.length || 'No'
  } commit${selectedCommits.length === 1 ? '' : 's'} selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection ? commits.filter((d) => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  // Count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';
  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function brushed(event) {
  const selection = event.selection;

  d3.select('#chart')
    .selectAll('circle')
    .classed('selected', (d) => isCommitSelected(selection, d));

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function createBrushSelector(svg, usableArea) {
  svg.call(
    d3
      .brush()
      // only let the brush move inside the plot area, not over the axes
      .extent([
        [usableArea.left, usableArea.top],
        [usableArea.right, usableArea.bottom],
      ])
      .on('start brush end', brushed),
  );

  // The brush adds an overlay (and a selection rectangle) that swallow mouse
  // events. Move the dots to the END of the svg so they sit on top of all of
  // them and tooltips keep working, even for dots inside the selection (Step 5.2).
  svg.select('.dots').raise();
}

// ---------------------------------------------------------------------------
// Step 2 + 3 + 4: scatterplot of commits by date and time of day
// ---------------------------------------------------------------------------
function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Leave room for the axes (the y labels need more than a few pixels)
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // Scales: a time scale for dates, a linear scale for hour of day (0-24)
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  // Step 4.1 / 4.2: dot AREA (not radius) is proportional to lines edited
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // "Going further": orange around midday, blue at night
  // (Blending in HCL passes through purple/red like a sunset instead of a muddy grey.)
  const timeColor = d3
    .scaleLinear()
    .domain([0, 12, 24])
    .range(['#1e3a8a', '#f59e0b', '#1e3a8a'])
    .interpolate(d3.interpolateHcl);

  // Step 2.3: gridlines are an axis with no labels and very long ticks.
  // They go in BEFORE the axes and dots so they sit underneath.
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Step 2.2: axes
  const xAxis = d3.axisBottom(xScale).ticks(7); // fewer ticks so the labels don't collide
  const yAxis = d3.axisLeft(yScale).tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg.append('g').attr('transform', `translate(0, ${usableArea.bottom})`).call(xAxis);
  svg.append('g').attr('transform', `translate(${usableArea.left}, 0)`).call(yAxis);

  // Step 4.3: draw big dots first so small ones end up on top and stay hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  const dots = svg.append('g').attr('class', 'dots');

  dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => timeColor(d.hourFrac))
    .style('fill-opacity', 0.7) // see-through so overlapping dots stay visible
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // Step 5: brushing (after the dots exist, so .raise() can reorder them)
  createBrushSelector(svg, usableArea);
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------
try {
  data = await loadData();
  commits = processCommits(data);

  renderCommitInfo(data, commits);
  renderScatterPlot(data, commits);
} catch (error) {
  console.error('Could not load meta/loc.csv:', error);
  document.querySelector('#stats').textContent =
    'Could not load loc.csv. Run the elocuent command and make sure meta/loc.csv exists.';
}