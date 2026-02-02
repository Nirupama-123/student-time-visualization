// ---------- CONFIG ----------
const MILL_DATA_URL =
  "https://raw.githubusercontent.com/Nirupama-123/Students_lifestyle_dataset_1/main/combined_student_lifestyle_36000.csv";

const stressLevels = ["Low", "Moderate", "High"];
const stressColors = {
  Low: "#00e676",      // green
  Moderate: "#ffd54f", // yellow
  High: "#ff5252"      // red
};

const categoryColors = {
  Study: "#c792ea",
  Sleep: "#82aaff",
  Social: "#ffab91",
  Activity: "#7fd99b"
};

// *** NEW: global tooltip helper ***
function getGlobalTooltip() {
  let tooltip = d3.select("body").select(".dv-tooltip");
  if (tooltip.empty()) {
    tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "dv-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("background", "rgba(0,0,0,0.8)")
      .style("color", "#fff")
      .style("padding", "6px 10px")
      .style("border-radius", "6px")
      .style("font-size", "11px")
      .style("opacity", 0);
  }
  return tooltip;
}

// ---------- COLUMN AUTO-DETECTION HELPERS ----------
function findColumn(columns, patterns) {
  // patterns: array of regex that all must match (AND)
  let col = columns.find(c =>
    patterns.every(p => p.test(c))
  );
  if (col) return col;

  // fallback: first pattern alone (weak match)
  col = columns.find(c => patterns[0].test(c));
  return col || null;
}

function toNumber(v) {
  const n = +v;
  return Number.isFinite(n) ? n : 0;
}

// ---------- LOAD & PREP DATA ----------
d3.csv(MILL_DATA_URL).then(raw => {
  if (!raw || !raw.length) {
    console.warn("No data rows found for Millennials CSV.");
    return;
  }

  const columns = raw.columns || Object.keys(raw[0]);

  const studyCol = findColumn(columns, [/study/i, /hour|time/i]);
  const sleepCol = findColumn(columns, [/sleep/i, /hour|time/i]);
  const socialCol = findColumn(columns, [/social|friend|hangout/i, /hour|time/i]);
  const activityCol = findColumn(columns, [/physical|activity|exercise|sport/i, /hour|time|min/i]);
  const gpaCol = findColumn(columns, [/gpa|grade\s*point/i]);
  const stressCol = findColumn(columns, [/stress/i]);
  const generationCol = findColumn(columns, [/generation|gen\b/i]);

  console.log("Detected columns (Millennials):", {
    studyCol,
    sleepCol,
    socialCol,
    activityCol,
    gpaCol,
    stressCol,
    generationCol
  });

  let data = raw.map(d => ({
    generation: generationCol ? String(d[generationCol] || "").trim() : "",
    study: studyCol ? toNumber(d[studyCol]) : 0,
    sleep: sleepCol ? toNumber(d[sleepCol]) : 0,
    social: socialCol ? toNumber(d[socialCol]) : 0,
    activity: activityCol ? toNumber(d[activityCol]) : 0,
    gpa: gpaCol ? toNumber(d[gpaCol]) : 0,
    stress: stressCol ? String(d[stressCol] || "").trim() : "Unknown"
  }));

  const hasGeneration = data.some(r => r.generation);
  if (hasGeneration) {
    const before = data.length;
    data = data.filter(r => /millennial/i.test(r.generation));
    console.log(`Filtered Millennials: ${data.length} of ${before}`);
  }

  data = data.filter(
    d => d.study || d.sleep || d.social || d.activity || d.gpa
  );

  console.log("Final rows used for charts:", data.length);
  if (!data.length) {
    console.warn("No usable numeric rows for Millennials charts.");
    return;
  }

  // draw all charts
  drawOverviewTimeBreakdown("#mill_overview_time_breakdown", data);
  drawOverviewStudySleep("#mill_overview_study_sleep", data);

  drawBarStudyByStress("#mill_bar_study_stress", data);
  drawBarSocialByStress("#mill_bar_social_stress", data);
  drawStackedTimeByStress("#mill_stacked_time_distribution", data);

  drawTrendsStudySleep("#mill_scatter_study_sleep", data);
  drawSleepHistogram("#mill_hist_sleep", data);
  drawActivityGpaScatter("#mill_scatter_activity_gpa", data);

  drawStressDistribution("#mill_donut_stress", data);
  drawGpaByStress("#mill_box_gpa_stress", data);
}).catch(err => {
  console.error("Error loading Millennials data:", err);
});

// ---------- SHARED CHART HELPERS ----------
// Only layout / sizing is tuned here so charts are a bit shorter but still clear.
function createBaseChart(containerSelector) {
  const container = d3.select(containerSelector);
  if (container.empty()) return null;

  const node = container.node();
  const width =
    node.clientWidth || node.getBoundingClientRect().width || 520;

  // Compact charts (bars, stacked, scatters, hist)
  const compactMatch = /mill_bar_|mill_stacked_|mill_scatter_|mill_hist_/i.test(
    containerSelector
  );

  // Slightly smaller heights to reduce card space usage
  const height = compactMatch ? 240 : 260;

  // Bottom margin keeps ticks + x-label + legend all inside without overlap
  const margin = {
    top: 30,
    right: 30,
    bottom: 80,
    left: 70
  };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Clear previous SVG
  container.selectAll("*").remove();

  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Legend sits a bit below the x-axis label
  const legendY = innerHeight + 32;

  return {
    svg,
    g,
    width,
    height,
    innerWidth,
    innerHeight,
    margin,
    legendY,
    containerSelector
  };
}

function addAxes(g, innerWidth, innerHeight, xScale, yScale, xLabel, yLabel) {
  const xAxis = d3.axisBottom(xScale).ticks(6);
  const yAxis = d3.axisLeft(yScale).ticks(6);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "axis axis-x")
    .call(xAxis);

  g.append("g")
    .attr("class", "axis axis-y")
    .call(yAxis);

  // X label – directly under ticks, with space left for legend below
  g.append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 18)
    .attr("text-anchor", "middle")
    .text(xLabel);

  // Y label
  g.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .text(yLabel);
}

function addLegendBelow(g, legendY, items) {
  // items: [{ label, color }]
  const legend = g
    .append("g")
    .attr("class", "chart-legend")
    .attr("transform", `translate(0,${legendY})`);

  const itemSpacing = 110;

  const legendItems = legend
    .selectAll(".legend-item")
    .data(items)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(${i * itemSpacing},0)`);

  legendItems
    .append("rect")
    .attr("width", 14)
    .attr("height", 14)
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("fill", d => d.color);

  legendItems
    .append("text")
    .attr("x", 20)
    .attr("y", 11)
    .attr("class", "legend-label")
    .text(d => d.label);
}

// ---------- OVERVIEW CHARTS ----------
function drawOverviewTimeBreakdown(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;

  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const metrics = ["Study", "Sleep", "Social", "Activity"];

  const averages = metrics.map(m => {
    const key = m.toLowerCase();
    const vals = data.map(d => d[key]).filter(v => v > 0);
    const mean = vals.length > 0 ? d3.mean(vals) : 0;
    return { category: m, value: mean };
  });

  const x = d3.scaleBand()
    .domain(averages.map(d => d.category))
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(averages, d => d.value) || 1])
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Category",
    "Average hours per day"
  );

  g.selectAll(".bar")
    .data(averages)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.category))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.value))
    .attr("fill", d => categoryColors[d.category])
    .attr("data-category", d => d.category)        // *** NEW ***
    .attr("opacity", 0.9)                          // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Category: ${d.category}<br>Average hours: ${d.value.toFixed(2)}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    averages.map(d => ({
      label: d.category,
      color: categoryColors[d.category]
    }))
  );

  // *** NEW: legend highlight by category ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-category]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-category");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  // click outside container → clear highlight
  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

function drawOverviewStudySleep(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const filtered = data.filter(d => d.study && d.sleep);
  if (!filtered.length) return;

  const x = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.study))
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.sleep))
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Study hours per day",
    "Sleep hours per day"
  );

  g.selectAll(".point")
    .data(filtered)
    .enter()
    .append("circle")
    .attr("class", "scatter-point")
    .attr("cx", d => x(d.study))
    .attr("cy", d => y(d.sleep))
    .attr("r", 3)
    .attr("fill", d => stressColors[d.stress] || "#ffffff66")
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Study: ${d.study.toFixed(
            2
          )} hrs<br>Sleep: ${d.sleep.toFixed(2)} hrs`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

// ---------- BAR CHARTS ----------
function aggregateByStress(data, metricKey) {
  const groups = d3.group(data, d => d.stress);
  const result = [];

  stressLevels.forEach(level => {
    const rows = groups.get(level) || [];
    const vals = rows.map(d => d[metricKey]).filter(v => v > 0);
    const mean = vals.length > 0 ? d3.mean(vals) : 0;
    result.push({
      stress: level,
      value: mean
    });
  });

  return result;
}

function drawBarStudyByStress(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const agg = aggregateByStress(data, "study");

  const x = d3.scaleBand()
    .domain(stressLevels)
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.value) || 1])
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Stress level",
    "Avg study hours / day"
  );

  g.selectAll(".bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.stress))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.value))
    .attr("fill", d => stressColors[d.stress])
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Avg study hours: ${d.value.toFixed(2)}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

function drawBarSocialByStress(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const agg = aggregateByStress(data, "social");

  const x = d3.scaleBand()
    .domain(stressLevels)
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.value) || 1])
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Stress level",
    "Avg social hours / day"
  );

  g.selectAll(".bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.stress))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.value))
    .attr("fill", d => stressColors[d.stress])
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Avg social hours: ${d.value.toFixed(2)}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

function drawStackedTimeByStress(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const agg = stressLevels.map(level => {
    const rows = data.filter(d => d.stress === level);
    const study = d3.mean(rows, d => d.study) || 0;
    const sleep = d3.mean(rows, d => d.sleep) || 0;
    const social = d3.mean(rows, d => d.social) || 0;
    return { stress: level, Study: study, Sleep: sleep, Social: social };
  });

  const subKeys = ["Study", "Sleep", "Social"];

  const x = d3.scaleBand()
    .domain(stressLevels)
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.Study + d.Sleep + d.Social) || 1])
    .nice()
    .range([innerHeight, 0]);

  const stack = d3.stack().keys(subKeys);
  const stackedData = stack(agg);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Stress level",
    "Total avg hours (Study + Sleep + Social)"
  );

  const subColor = {
    Study: categoryColors.Study,
    Sleep: categoryColors.Sleep,
    Social: categoryColors.Social
  };

  const layers = g.selectAll(".stack-layer")
    .data(stackedData)
    .enter()
    .append("g")
    .attr("class", "stack-layer")
    .attr("fill", d => subColor[d.key])
    .attr("data-subkey", d => d.key); // *** NEW ***

  layers
    .selectAll("rect")
    .data(d => d)
    .enter()
    .append("rect")
    .attr("x", d => x(d.data.stress))
    .attr("width", x.bandwidth())
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]))
    .attr("data-subkey", function () {
      return d3.select(this.parentNode).datum().key; // *** NEW ***
    })
    .attr("opacity", 0.9) // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", function (event, d) {
      const subKey = d3.select(this).attr("data-subkey");
      const val = d[1] - d[0];
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.data.stress}<br>Category: ${subKey}<br>Avg hours: ${val.toFixed(
            2
          )}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    subKeys.map(k => ({
      label: k,
      color: subColor[k]
    }))
  );

  // *** NEW: legend highlight by subKey (Study/Sleep/Social) ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-subkey]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-subkey");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

// ---------- TRENDS & DISTRIBUTIONS ----------
function drawTrendsStudySleep(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const filtered = data.filter(d => d.study && d.sleep);
  if (!filtered.length) return;

  const x = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.study))
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.sleep))
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Study hours per day",
    "Sleep hours per day"
  );

  g.selectAll(".point")
    .data(filtered)
    .enter()
    .append("circle")
    .attr("class", "scatter-point")
    .attr("cx", d => x(d.study))
    .attr("cy", d => y(d.sleep))
    .attr("r", 3)
    .attr("fill", d => stressColors[d.stress] || "#ffffff66")
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Study: ${d.study.toFixed(
            2
          )} hrs<br>Sleep: ${d.sleep.toFixed(2)} hrs`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

function drawSleepHistogram(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const vals = data
    .map(d => d.sleep)
    .filter(v => v > 0);

  if (!vals.length) return;

  const x = d3.scaleLinear()
    .domain(d3.extent(vals))
    .nice()
    .range([0, innerWidth]);

  const bins = d3.bin()
    .domain(x.domain())
    .thresholds(15)(vals);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, d => d.length)])
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Sleep hours per day",
    "Number of students"
  );

  g.selectAll(".bin")
    .data(bins)
    .enter()
    .append("rect")
    .attr("class", "bin-rect")
    .attr("x", d => x(d.x0))
    .attr("y", d => y(d.length))
    .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
    .attr("height", d => innerHeight - y(d.length))
    .attr("fill", "#82aaff")
    .attr("opacity", 0.9)  // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Range: ${d.x0.toFixed(1)} - ${d.x1.toFixed(
            1
          )} hrs<br>Students: ${d.length}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(g, legendY, [
    { label: "Sleep hours distribution", color: "#82aaff" }
  ]);

  // Legend here has only one item – no complex highlight needed.
}

function drawActivityGpaScatter(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const filtered = data.filter(
    d => d.activity && d.gpa
  );
  if (!filtered.length) return;

  const x = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.activity))
    .nice()
    .range([0, innerWidth]);

  const y = d3.scaleLinear()
    .domain(d3.extent(filtered, d => d.gpa))
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Physical activity hours per day",
    "GPA"
  );

  g.selectAll(".point")
    .data(filtered)
    .enter()
    .append("circle")
    .attr("class", "scatter-point")
    .attr("cx", d => x(d.activity))
    .attr("cy", d => y(d.gpa))
    .attr("r", 3)
    .attr("fill", d => stressColors[d.stress] || "#ffffff66")
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Activity: ${d.activity.toFixed(
            2
          )} hrs<br>GPA: ${d.gpa.toFixed(2)}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

// ---------- STRESS & GPA ----------
function drawStressDistribution(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const counts = d3.rollup(
    data,
    v => v.length,
    d => d.stress
  );

  const agg = stressLevels.map(level => ({
    stress: level,
    value: counts.get(level) || 0
  }));

  const x = d3.scaleBand()
    .domain(stressLevels)
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.value) || 1])
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Stress levels",
    "Number of students"
  );

  g.selectAll(".bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.stress))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.value))
    .attr("fill", d => stressColors[d.stress])
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Students: ${d.value}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

function drawGpaByStress(selector, data) {
  const base = createBaseChart(selector);
  if (!base) return;
  const { g, innerWidth, innerHeight, legendY, containerSelector } = base;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const groups = d3.group(data, d => d.stress);
  const agg = stressLevels.map(level => {
    const rows = groups.get(level) || [];
    const vals = rows.map(d => d.gpa).filter(v => v > 0);
    const mean = vals.length > 0 ? d3.mean(vals) : 0;
    return { stress: level, value: mean };
  });

  const x = d3.scaleBand()
    .domain(stressLevels)
    .range([0, innerWidth])
    .padding(0.3);

  const y = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.value) || 4.0])
    .nice()
    .range([innerHeight, 0]);

  addAxes(
    g,
    innerWidth,
    innerHeight,
    x,
    y,
    "Stress level",
    "Average GPA"
  );

  g.selectAll(".bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.stress))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.value))
    .attr("fill", d => stressColors[d.stress])
    .attr("data-stress", d => d.stress)   // *** NEW ***
    .attr("opacity", 0.9)                 // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.stress}<br>Average GPA: ${d.value.toFixed(2)}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  addLegendBelow(
    g,
    legendY,
    stressLevels.map(s => ({
      label: s,
      color: stressColors[s]
    }))
  );

  // *** NEW: legend highlight by stress ***
  const legend = g.select(".chart-legend");
  const legendItems = legend.selectAll(".legend-item");
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legendItems.each(function (d) {
      const row = d3.select(this);
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (d.label === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems
    .on("mouseenter", (event, d) => {
      hoverKey = d.label;
      applyHighlight();
    })
    .on("mouseleave", () => {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", (event, d) => {
      activeKey = activeKey === d.label ? null : d.label;
      applyHighlight();
    });

  const container = d3.select(containerSelector);
  if (!container.empty()) {
    document.addEventListener("click", evt => {
      if (!container.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}
