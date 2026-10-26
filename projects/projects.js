import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');

// D3 helpers (Steps 1-2)
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value).sort(null); // keep our own order
// Key colors by year (not by slice position) so a year keeps its color while searching.
const colors = d3.scaleOrdinal(d3.schemeTableau10).domain(
  [...new Set(projects.map((p) => p.year))].sort(d3.descending),
);

// ---------------------------------------------------------------------------
// State. These two values are the single source of truth for what is shown.
//
// Bug fix (Step 5.4): the starting version tracked the selection as a slice
// *index* (selectedIndex) and each handler (search, click) filtered the full
// `projects` array on its own, so one filter always erased the other. Now both
// filters live here and one function combines them every time.
// ---------------------------------------------------------------------------
let query = '';
let selectedYear = null; // a year label such as '2024', or null for "no selection"

// Step 4.3: case-insensitive search across all project metadata
function matchesQuery(project) {
  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(query.trim().toLowerCase());
}

// 1) search filter -> drives the pie chart and legend
function searchedProjects() {
  return projects.filter(matchesQuery);
}

// 2) search filter + year filter -> drives the project cards
function visibleProjects() {
  const searched = searchedProjects();
  return selectedYear === null
    ? searched
    : searched.filter((p) => p.year === selectedYear);
}

// Click on a wedge or legend entry: select it, or deselect if already selected
function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
  renderSelection();
  renderProjectList();
}

// Step 4.4 + 2.2: (re)draw the pie and legend from the searched projects
function renderPieChart(projectsGiven) {
  const data = d3
    .rollups(projectsGiven, (v) => v.length, (d) => d.year)
    .map(([year, count]) => ({ value: count, label: year }))
    .sort((a, b) => d3.descending(a.label, b.label));

  // If the selected year no longer appears in the search results, drop the selection
  if (selectedYear !== null && !data.some((d) => d.label === selectedYear)) {
    selectedYear = null;
  }

  const arcData = sliceGenerator(data);

  // join() adds/updates/removes <path>s so nothing is drawn twice
  svg
    .selectAll('path')
    .data(arcData)
    .join('path')
    .attr('d', (d) => arcGenerator(d))
    .attr('fill', (d) => colors(d.data.label))
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.data.label}: ${d.data.value} project${d.data.value === 1 ? '' : 's'}`)
    .on('click', (_, d) => toggleYear(d.data.label))
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleYear(d.data.label);
      }
    });

  legend
    .selectAll('li')
    .data(data)
    .join('li')
    .attr('class', 'legend-item')
    .attr('style', (d) => `--color:${colors(d.label)}`)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .html((d) => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
    .on('click', (_, d) => toggleYear(d.label))
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleYear(d.label);
      }
    });
}

// Step 5.2: highlight the selected wedge and legend entry
function renderSelection() {
  svg
    .selectAll('path')
    .classed('selected', (d) => d.data.label === selectedYear)
    .attr('aria-pressed', (d) => d.data.label === selectedYear);

  legend
    .selectAll('li')
    .classed('selected', (d) => d.label === selectedYear)
    .attr('aria-pressed', (d) => d.label === selectedYear);
}

// Step 1.6 + 5.3: show whichever projects pass BOTH filters
function renderProjectList() {
  const visible = visibleProjects();

  renderProjects(visible, projectsContainer, 'h2');

  projectsTitle.textContent = `${visible.length} Project${visible.length === 1 ? '' : 's'}`;

  if (visible.length === 0) {
    projectsContainer.insertAdjacentHTML(
      'beforeend',
      '<p class="no-results">No projects match your search.</p>',
    );
  }
}

// Redraw everything from the current state
function render() {
  renderPieChart(searchedProjects());
  renderSelection();
  renderProjectList();
}

// 'input' fires on every keystroke (the lab's 'change' waits for Enter/blur)
searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  render();
});

// First render on page load
render();