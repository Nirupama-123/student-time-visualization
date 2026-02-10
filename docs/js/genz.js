// genz.js – Gen-Z Lifestyle Dashboard
// ===================================

console.log("Gen Z dashboard JS loaded ✅");

const DATA_PATH =
  "https://raw.githubusercontent.com/Nirupama-123/Students_lifestyle_dataset_1/main/combined_student_lifestyle_36000.csv";

// column mapping
const COLS = {
  id: "Student_ID",
  study: "Study_Hours_Per_Day",
  sleep: "Sleep_Hours_Per_Day",
  social: "Social_Hours_Per_Day",
  activity: "Physical_Activity_Hours_Per_Day",
  gpa: "GPA",
  stress: "Stress_Level",
  generation: "Generation",
};

// stress metadata used by many charts
const STRESS_LEVELS = ["Low", "Moderate", "High"];
const STRESS_COLORS = {
  Low: "#22c55e", // green
  Moderate: "#a855f7", // purple
  High: "#f97316", // orange
};

// small helper
function toNum(v) {
  const n = +v;
  return isNaN(n) ? NaN : n;
}

// ---------- TOOLTIP HELPERS ----------

// safer: supports selector string OR a d3 selection
function makeTooltip(containerSel) {
  const container =
    containerSel && containerSel.node
      ? containerSel
      : d3.select(containerSel);

  let tooltip = container.select(".genz-tooltip");
  if (tooltip.empty()) {
    tooltip = container
      .append("div")
      .attr("class", "genz-tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("background", "rgba(15, 6, 45, 0.96)")
      .style("border", "1px solid rgba(199, 180, 255, 0.6)")
      .style("border-radius", "8px")
      .style("padding", "8px 10px")
      .style("font-size", "11px")
      .style("color", "#f9f5ff")
      .style("box-shadow", "0 12px 30px rgba(0,0,0,0.4)")
      .style("opacity", 0)
      .style("z-index", 20);
  }
  return tooltip;
}

function positionTooltip(event, container, tooltip) {
  const [mx, my] = d3.pointer(event, container.node());
  const bb = container.node().getBoundingClientRect();

  const tooltipWidth = 190;
  const tooltipHeight = 90;

  let x = mx + 14;
  let y = my + 14;

  // clamp inside the card
  x = Math.max(8, Math.min(x, bb.width - tooltipWidth - 8));
  y = Math.max(8, Math.min(y, bb.height - tooltipHeight - 8));

  tooltip.style("left", `${x}px`).style("top", `${y}px`);
}

// ---------- SMALL HELPERS FOR NEW CHARTS ----------

function kernelDensityEstimator(kernel, X) {
  return function (V) {
    if (!V.length) return X.map((x) => [x, 0]);
    return X.map((x) => [x, d3.mean(V, (v) => kernel(x - v))]);
  };
}

function kernelEpanechnikov(k) {
  return function (v) {
    v /= k;
    return Math.abs(v) <= 1 ? (0.75 * (1 - v * v)) / k : 0;
  };
}

// ---------- SHARED LEGEND (used by violin / ridgeline / strip) ----------
// - Single-select highlight
// - Click again or click outside SVG -> reset
// - onToggle(name, isActive, selectedNameOrNull)
function drawInteractiveLegend(svg, items, colorFn, width, onToggle) {
  const group = svg
    .append("g")
    .attr("class", "genz-legend")
    .attr("transform", `translate(${width / 2 - 140}, 18)`);

  let selected = null; // null = no filter

  const legendItems = [];

  items.forEach((name, i) => {
    const g = group
      .append("g")
      .attr("class", "legend-item")
      .attr("data-name", name)
      .attr("transform", `translate(${i * 90},0)`);

    g.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", colorFn(name))
      .attr("stroke", colorFn(name));

    g.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .style("fill", "#f4f1ff")
      .style("font-size", "10px")
      .text(name);

    g.style("cursor", "pointer").on("click", (event) => {
      event.stopPropagation(); // do not trigger svg click
      selected = selected === name ? null : name;
      applyHighlight();
    });

    legendItems.push({ name, g });
  });

  function applyHighlight() {
    legendItems.forEach(({ name, g }) => {
      const isActive = selected === null || selected === name;
      g.select("rect").attr("fill-opacity", isActive ? 1 : 0.25);
      g.select("text").attr("fill-opacity", isActive ? 1 : 0.5);

      if (onToggle) {
        onToggle(name, isActive, selected);
      }
    });
  }

  // click anywhere on SVG background resets highlight
  svg.on("click.legendReset", () => {
    if (selected !== null) {
      selected = null;
      applyHighlight();
    }
  });

  applyHighlight();
}

// ---------- DATA LOAD ----------

d3.csv(DATA_PATH).then((data) => {
  const genZ = data.filter((d) => {
    const g = String(d[COLS.generation] || "").trim().toLowerCase();
    return g === "gen z" || g === "genz";
  });

  // Overview
  drawOverviewBars(genZ);
  drawStudySleepScatter(
    genZ,
    COLS.study,
    COLS.sleep,
    "#genz_overview_study_sleep",
    {
      titleX: `Study Hours per Day (${COLS.study})`,
      titleY: `Sleep Hours per Day (${COLS.sleep})`,
      sampleLimit: 5000,
      pointRadius: 1.3,
    }
  );

  // Bar charts
  drawAvgStudyByStress(genZ);
  drawAvgSocialByStress(genZ);
  drawStackedTimeByStress(genZ);

  // Trends & Distributions
  drawStudyViolinGenZ(genZ);
  drawSleepRidgelineGenZ(genZ);
  drawGpaStripGenZ(genZ);

  // Stress & GPA
  drawStressDonut(genZ);
  drawGpaByStress(genZ);
});

// =====================================================
//  OVERVIEW – Avg daily time breakdown
// =====================================================

function drawOverviewBars(raw) {
  const container = d3.select("#genz_overview_time_breakdown");
  if (container.empty()) return;

  const vals = raw.map((d) => ({
    study: toNum(d[COLS.study]),
    sleep: toNum(d[COLS.sleep]),
    social: toNum(d[COLS.social]),
    activity: toNum(d[COLS.activity]),
  }));

  const clean = vals.filter(
    (d) =>
      !isNaN(d.study) &&
      !isNaN(d.sleep) &&
      !isNaN(d.social) &&
      !isNaN(d.activity)
  );
  if (!clean.length) return;

  const avg = {
    Study: d3.mean(clean, (d) => d.study),
    Sleep: d3.mean(clean, (d) => d.sleep),
    Social: d3.mean(clean, (d) => d.social),
    Physical: d3.mean(clean, (d) => d.activity),
  };

  const series = Object.entries(avg).map(([k, v]) => ({
    activity: k,
    hours: v,
  }));

  const width = 360;
  const height = 260;
  const margin = { top: 26, right: 20, bottom: 80, left: 70 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleBand()
    .domain(series.map((d) => d.activity))
    .range([margin.left, width - margin.right])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(series, (d) => d.hours) * 1.1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const colorMap = {
    Study: "#38bdf8",
    Sleep: "#a855f7",
    Social: "#f97316",
    Physical: "#22c55e",
  };

  const tooltip = makeTooltip(container);

  svg
    .selectAll("rect")
    .data(series)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.activity))
    .attr("y", (d) => y(d.hours))
    .attr("width", x.bandwidth())
    .attr("height", (d) => y(0) - y(d.hours))
    .attr("fill", (d) => colorMap[d.activity])
    .attr("rx", 6)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.activity}</strong><br/>Average: ${d.hours.toFixed(
            2
          )} hrs/day`
        );
    })
    .on("mousemove", (event) => positionTooltip(event, container, tooltip))
    .on("mouseout", () => tooltip.style("opacity", 0));

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("fill", "#d6ccff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .selectAll("text")
    .style("fill", "#d6ccff")
    .style("font-size", "11px");

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(161,140,255,0.6)");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 36)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Activity Type");

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 20)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Average Hours per Day");
}

// =====================================================
// SHARED: Study vs Sleep scatter (overview)
// =====================================================

function drawStudySleepScatter(
  raw,
  studyCol,
  sleepCol,
  containerSelector,
  options
) {
  const container = d3.select(containerSelector);
  if (container.empty()) return;

  let rows = raw
    .map((d) => ({
      study: toNum(d[studyCol]),
      sleep: toNum(d[sleepCol]),
    }))
    .filter((d) => !isNaN(d.study) && !isNaN(d.sleep));

  if (!rows.length) return;

  const sampleLimit = options.sampleLimit || 8000;
  if (rows.length > sampleLimit) {
    rows = d3.shuffle(rows.slice()).slice(0, sampleLimit);
  }

  const width = 360;
  const height = 320;
  const margin = { top: 34, right: 20, bottom: 110, left: 62 }; // big bottom for legend

  // sleep category for legend
  function sleepCategory(s) {
    if (s < 6) return "Less Sleep (< 6 hrs)";
    if (s < 8) return "Average Sleep (6–8 hrs)";
    return "More Sleep (> 8 hrs)";
  }
  rows.forEach((d) => {
    d.cat = sleepCategory(d.sleep);
  });

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const studyExtent = d3.extent(rows, (d) => d.study);
  const sleepExtent = d3.extent(rows, (d) => d.sleep);

  const x = d3
    .scaleLinear()
    .domain(studyExtent)
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain(sleepExtent)
    .nice()
    .range([height - margin.bottom, margin.top]);

  const categoryColor = {
    "Less Sleep (< 6 hrs)": "#22c55e",
    "Average Sleep (6–8 hrs)": "#eab308",
    "More Sleep (> 8 hrs)": "#f97316",
  };

  const tooltip = makeTooltip(container);

  const circles = svg
    .selectAll("circle")
    .data(rows)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.study))
    .attr("cy", (d) => y(d.sleep))
    .attr("r", options.pointRadius || 1.2)
    .attr("fill", (d) => categoryColor[d.cat])
    .attr("fill-opacity", 0.7)
    .attr("stroke", "none")
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>Study:</strong> ${d.study.toFixed(
            1
          )} hrs<br><strong>Sleep:</strong> ${d.sleep.toFixed(1)} hrs`
        );
    })
    .on("mousemove", (event) => positionTooltip(event, container, tooltip))
    .on("mouseout", () => tooltip.style("opacity", 0));

  const xAxis = d3.axisBottom(x).ticks(6);
  const yAxis = d3.axisLeft(y).ticks(5);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("fill", "#c7b7ff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .selectAll("text")
    .style("fill", "#c7b7ff")
    .style("font-size", "11px");

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(170,150,255,0.6)");

  // axis labels
  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 32)
    .attr("text-anchor", "middle")
    .style("fill", "#e5e0ff")
    .style("font-size", "11px")
    .text(options.titleX || `Study Hours per Day (${studyCol})`);

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 18)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#e5e0ff")
    .style("font-size", "11px")
    .text(options.titleY || `Sleep Hours per Day (${sleepCol})`);

  // Legend with highlight behaviour
  const legendData = Object.keys(categoryColor);
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${width / 2 - 150}, ${height - margin.bottom + 60})`
    );

  let selected = null; // selected category, null = all
  const legendItems = [];

  legendData.forEach((name, i) => {
    const g = legend.append("g").attr("transform", `translate(${i * 110},0)`);

    g.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", categoryColor[name]);

    g.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .style("fill", "#e5e0ff")
      .style("font-size", "10px")
      .text(name);

    g.style("cursor", "pointer").on("click", (event) => {
      event.stopPropagation(); // don't reset via svg handler
      selected = selected === name ? null : name;
      applyHighlight();
    });

    legendItems.push({ name, g });
  });

  function applyHighlight() {
    legendItems.forEach(({ name, g }) => {
      const isActive = selected === null || selected === name;
      g.select("rect").attr("fill-opacity", isActive ? 1 : 0.25);
      g.select("text").attr("fill-opacity", isActive ? 1 : 0.5);
    });

    circles.attr("fill-opacity", (d) => {
      if (selected === null) return 0.7;
      return d.cat === selected ? 0.9 : 0.08;
    });
  }

  // click anywhere on svg clears highlight
  svg.on("click.legendResetScatter", () => {
    if (selected !== null) {
      selected = null;
      applyHighlight();
    }
  });

  applyHighlight();
}

// =====================================================
// BAR CHARTS BY STRESS LEVEL
// =====================================================

function groupByStress(raw) {
  const byStress = d3.group(raw, (d) => d[COLS.stress]);
  const levels = STRESS_LEVELS;

  return levels
    .filter((lvl) => byStress.has(lvl))
    .map((lvl) => ({
      stress: lvl,
      rows: byStress.get(lvl),
    }));
}

function drawAvgStudyByStress(raw) {
  const container = d3.select("#genz_bar_study_stress");
  if (container.empty()) return;

  const groups = groupByStress(raw).map((g) => ({
    stress: g.stress,
    avg: d3.mean(g.rows, (d) => toNum(d[COLS.study])),
  }));

  drawSimpleBar(
    container,
    groups,
    {
      xKey: "stress",
      yKey: "avg",
      xLabel: "Stress Level (Stress_Level)",
      yLabel: `Average Study Hours per Day (${COLS.study})`,
    },
    { Low: "#22c55e", Moderate: "#eab308", High: "#f97316" }
  );
}

function drawAvgSocialByStress(raw) {
  const container = d3.select("#genz_bar_social_stress");
  if (container.empty()) return;

  const groups = groupByStress(raw).map((g) => ({
    stress: g.stress,
    avg: d3.mean(g.rows, (d) => toNum(d[COLS.social])),
  }));

  drawSimpleBar(
    container,
    groups,
    {
      xKey: "stress",
      yKey: "avg",
      xLabel: "Stress Level (Stress_Level)",
      yLabel: `Average Social Hours per Day (${COLS.social})`,
    },
    { Low: "#38bdf8", Moderate: "#a855f7", High: "#f97316" }
  );
}

function drawSimpleBar(container, data, labels, colorMap) {
  const width = 360;
  const height = 260;
  const margin = { top: 26, right: 20, bottom: 90, left: 80 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleBand()
    .domain(data.map((d) => d[labels.xKey]))
    .range([margin.left, width - margin.right])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d[labels.yKey]) * 1.1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const tooltip = makeTooltip(container);

  const bars = svg
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d[labels.xKey]))
    .attr("y", (d) => y(d[labels.yKey]))
    .attr("width", x.bandwidth())
    .attr("height", (d) => y(0) - y(d[labels.yKey]))
    .attr("fill", (d) => colorMap[d[labels.xKey]])
    .attr("rx", 0)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d[labels.xKey]} stress</strong><br/>Average: ${d[
            labels.yKey
          ].toFixed(2)} hrs/day`
        );
    })
    .on("mousemove", (event) => positionTooltip(event, container, tooltip))
    .on("mouseout", () => tooltip.style("opacity", 0));

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(161,140,255,0.6)");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 32)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text(labels.xLabel);

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 24)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text(labels.yLabel);

  // interactive legend under axis centre
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${width / 2 - 80}, ${height - margin.bottom + 58})`
    );

  const levels = ["Low", "Moderate", "High"];
  let selectedLevel = null;
  const legendItems = [];

  levels.forEach((level, i) => {
    const g = legend.append("g").attr("transform", `translate(${i * 70},0)`);

    g.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", colorMap[level]);

    g.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .style("fill", "#f4f1ff")
      .style("font-size", "10px")
      .text(level);

    g.style("cursor", "pointer").on("click", (event) => {
      event.stopPropagation();
      selectedLevel = selectedLevel === level ? null : level;
      applyBarHighlight();
    });

    legendItems.push({ level, g });
  });

  function applyBarHighlight() {
    legendItems.forEach(({ level, g }) => {
      const active = selectedLevel === null || selectedLevel === level;
      g.select("rect").attr("fill-opacity", active ? 1 : 0.25);
      g.select("text").attr("fill-opacity", active ? 1 : 0.5);
    });

    bars.style("opacity", (d) => {
      if (selectedLevel === null) return 1;
      return d[labels.xKey] === selectedLevel ? 1 : 0.2;
    });
  }

  svg.on("click.legendResetBars", () => {
    if (selectedLevel !== null) {
      selectedLevel = null;
      applyBarHighlight();
    }
  });

  applyBarHighlight();
}

// ---------- Stacked bar: Study + Sleep + Social vs Stress ----------

function drawStackedTimeByStress(raw) {
  const container = d3.select("#genz_stacked_time_distribution");
  if (container.empty()) return;

  const groups = groupByStress(raw).map((g) => ({
    stress: g.stress,
    study: d3.mean(g.rows, (d) => toNum(d[COLS.study])),
    sleep: d3.mean(g.rows, (d) => toNum(d[COLS.sleep])),
    social: d3.mean(g.rows, (d) => toNum(d[COLS.social])),
  }));

  const keys = ["study", "sleep", "social"];
  const width = 360;
  const height = 260;
  const margin = { top: 26, right: 140, bottom: 90, left: 80 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleBand()
    .domain(groups.map((d) => d.stress))
    .range([margin.left, width - margin.right])
    .padding(0.3);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(groups, (d) => d.study + d.sleep + d.social) * 1.1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = {
    study: "#6366f1",
    sleep: "#ec4899",
    social: "#22d3ee",
  };

  const stacked = d3.stack().keys(keys)(groups);

  const tooltip = makeTooltip(container);

  svg
    .selectAll("g.layer")
    .data(stacked)
    .enter()
    .append("g")
    .attr("class", "layer")
    .attr("fill", (d) => color[d.key])
    .selectAll("rect")
    .data((d) => d)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.data.stress))
    .attr("width", x.bandwidth())
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => y(d[0]) - y(d[1]))
    .attr("rx", 0)
    .on("mouseover", (event, d) => {
      const total = d.data.study + d.data.sleep + d.data.social;
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.data.stress} stress</strong><br/>
           Study: ${d.data.study.toFixed(2)} hrs<br/>
           Sleep: ${d.data.sleep.toFixed(2)} hrs<br/>
           Social: ${d.data.social.toFixed(2)} hrs<br/>
           Total: ${total.toFixed(2)} hrs/day`
        );
    })
    .on("mousemove", (event) => positionTooltip(event, container, tooltip))
    .on("mouseout", () => tooltip.style("opacity", 0));

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(161,140,255,0.6)");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 32)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Stress Level (Stress_Level)");

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 30)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Average Hours per Day (Study / Sleep / Social)");

  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${width - margin.right + 10}, ${margin.top + 10})`
    );

  const legendItems = [
    { key: "study", label: "Study Hours" },
    { key: "sleep", label: "Sleep Hours" },
    { key: "social", label: "Social Hours" },
  ];

  legendItems.forEach((item, i) => {
    const g = legend.append("g").attr("transform", `translate(0,${i * 18})`);
    g.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", color[item.key]);

    g.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .style("fill", "#f4f1ff")
      .style("font-size", "10px")
      .text(item.label);
  });
}

// =====================================================
// GEN Z TRENDS & DISTRIBUTIONS CHARTS
// =====================================================

function drawStudyViolinGenZ(raw) {
  const container = d3.select("#genz_scatter_study_sleep");
  if (container.empty()) return;

  const rows = raw
    .map((d) => ({
      stress: d[COLS.stress],
      study: toNum(d[COLS.study]),
    }))
    .filter((d) => STRESS_LEVELS.includes(d.stress) && !isNaN(d.study));

  if (!rows.length) return;

  const width = 360;
  const height = 320;
  const margin = { top: 50, right: 20, bottom: 80, left: 60 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const xBand = d3
    .scaleBand()
    .domain(STRESS_LEVELS)
    .range([margin.left, width - margin.right])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(rows, (d) => d.study) || 10])
    .nice()
    .range([height - margin.bottom, margin.top + 20]);

  const xAxis = d3.axisBottom(xBand);
  const yAxis = d3.axisLeft(y).ticks(6);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(161,140,255,0.6)");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 34)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Stress Level (Stress_Level)");

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 22)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text(`Study Hours per Day (${COLS.study})`);

  const kde = kernelDensityEstimator(
    kernelEpanechnikov(0.35),
    d3.range(0, 12, 0.15)
  );

  const maxDensity = d3.max(
    STRESS_LEVELS.map((stress) => {
      const vals = rows.filter((r) => r.stress === stress).map((r) => r.study);
      if (!vals.length) return 0;
      const density = kde(vals);
      return d3.max(density, (d) => d[1]);
    })
  );

  const xNum = d3
    .scaleLinear()
    .domain([-maxDensity, maxDensity])
    .range([0, xBand.bandwidth()]);

  const tooltip = makeTooltip(container);

  STRESS_LEVELS.forEach((stress) => {
    const vals = rows.filter((r) => r.stress === stress).map((r) => r.study);
    if (!vals.length) return;

    const density = kde(vals);

    const g = svg
      .append("g")
      .attr("class", `violin violin-${stress}`)
      .attr("transform", `translate(${xBand(stress)},0)`);

    const area = d3
      .area()
      .curve(d3.curveCatmullRom)
      .x0((d) => xNum(-d[1]))
      .x1((d) => xNum(d[1]))
      .y((d) => y(d[0]));

    g.append("path")
      .datum(density)
      .attr("fill", STRESS_COLORS[stress])
      .attr("fill-opacity", 0.8)
      .attr("stroke", "#0b061a")
      .attr("stroke-width", 0.8)
      .attr("d", area);

    const sample = d3.shuffle(vals.slice()).slice(0, 120);

    g.selectAll("circle")
      .data(sample)
      .enter()
      .append("circle")
      .attr("cx", () => xNum((Math.random() - 0.5) * maxDensity * 0.9))
      .attr("cy", (d) => y(d))
      .attr("r", 2)
      .attr("fill", "#05030b")
      .attr("fill-opacity", 0.85)
      .on("mouseover", (event, v) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${stress} stress</strong><br/>Study: ${v.toFixed(
              1
            )} hrs/day`
          );
      })
      .on("mousemove", (event) => positionTooltip(event, container, tooltip))
      .on("mouseout", () => tooltip.style("opacity", 0));
  });

  drawInteractiveLegend(
    svg,
    STRESS_LEVELS,
    (d) => STRESS_COLORS[d],
    width,
    (stress, visible) => {
      svg.selectAll(`.violin-${stress}`).style("display", visible ? null : "none");
    }
  );
}

function drawSleepRidgelineGenZ(raw) {
  const container = d3.select("#genz_hist_sleep");
  if (container.empty()) return;

  const rows = raw
    .map((d) => ({
      stress: d[COLS.stress],
      sleep: toNum(d[COLS.sleep]),
    }))
    .filter((d) => STRESS_LEVELS.includes(d.stress) && !isNaN(d.sleep));

  if (!rows.length) return;

  const width = 360;
  const height = 320;
  const margin = { top: 50, right: 20, bottom: 60, left: 60 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(rows, (d) => d.sleep))
    .nice()
    .range([margin.left, width - margin.right]);

  const ridgeHeight =
    (height - margin.top - margin.bottom) / STRESS_LEVELS.length;

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6))
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 32)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text(`Sleep Hours per Day (${COLS.sleep})`);

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 22)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Density (per stress group)");

  const kde = kernelDensityEstimator(
    kernelEpanechnikov(0.3),
    d3.range(3.5, 10.5, 0.15)
  );

  const maxDensity = d3.max(
    STRESS_LEVELS.map((stress) => {
      const vals = rows.filter((r) => r.stress === stress).map((r) => r.sleep);
      if (!vals.length) return 0;
      const density = kde(vals);
      return d3.max(density, (d) => d[1]);
    })
  );

  const yDensity = d3
    .scaleLinear()
    .domain([0, maxDensity])
    .range([0, ridgeHeight * 0.9]);

  const tooltip = makeTooltip(container);

  STRESS_LEVELS.forEach((stress, i) => {
    const vals = rows.filter((r) => r.stress === stress).map((r) => r.sleep);
    if (!vals.length) return;

    const density = kde(vals);
    const baseline = margin.top + i * ridgeHeight;

    const g = svg
      .append("g")
      .attr("class", `ridge ridge-${stress}`)
      .attr("transform", `translate(0,${baseline})`);

    const area = d3
      .area()
      .curve(d3.curveCatmullRom)
      .x((d) => x(d[0]))
      .y0(ridgeHeight)
      .y1((d) => ridgeHeight - yDensity(d[1]));

    g.append("path")
      .datum(density)
      .attr("fill", STRESS_COLORS[stress])
      .attr("fill-opacity", 0.85)
      .attr("stroke", "#050014")
      .attr("stroke-width", 1)
      .attr("d", area);

    g.append("text")
      .attr("x", margin.left + 4)
      .attr("y", ridgeHeight - 4)
      .style("fill", "#fefbff")
      .style("font-size", "11px")
      .text(`${stress} stress`);

    const sample = d3.shuffle(vals.slice()).slice(0, 110);
    g.selectAll("circle")
      .data(sample)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d))
      .attr(
        "cy",
        () =>
          ridgeHeight -
          yDensity(maxDensity * 0.4) +
          (Math.random() - 0.5) * 12
      )
      .attr("r", 2)
      .attr("fill", "#05030b")
      .attr("fill-opacity", 0.9)
      .on("mouseover", (event, v) => {
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${stress} stress</strong><br/>Sleep: ${v.toFixed(
              1
            )} hrs/day`
          );
      })
      .on("mousemove", (event) => positionTooltip(event, container, tooltip))
      .on("mouseout", () => tooltip.style("opacity", 0));
  });

  drawInteractiveLegend(
    svg,
    STRESS_LEVELS,
    (d) => STRESS_COLORS[d],
    width,
    (stress, visible) => {
      svg.selectAll(`.ridge-${stress}`).style("display", visible ? null : "none");
    }
  );
}

function drawGpaStripGenZ(raw) {
  const container = d3.select("#genz_scatter_activity_gpa");
  if (container.empty()) return;

  const rows = raw
    .map((d) => ({
      stress: d[COLS.stress],
      gpa: toNum(d[COLS.gpa]),
      study: toNum(d[COLS.study]),
      sleep: toNum(d[COLS.sleep]),
      activity: toNum(d[COLS.activity]),
    }))
    .filter(
      (d) =>
        STRESS_LEVELS.includes(d.stress) &&
        !isNaN(d.gpa) &&
        !isNaN(d.study) &&
        !isNaN(d.sleep)
    );

  if (!rows.length) return;

  const width = 360;
  const height = 320;
  const margin = { top: 50, right: 20, bottom: 80, left: 60 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleLinear()
    .domain([1.8, 4.05])
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3
    .scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top + 20]);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6))
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(0));

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(161,140,255,0.6)");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 34)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text(`GPA (${COLS.gpa})`);

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 24)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Students (jittered)");

  const tooltip = makeTooltip(container);

  const jitter = 0.35;

  svg
    .append("g")
    .selectAll("circle")
    .data(rows)
    .enter()
    .append("circle")
    .attr("class", (d) => `strip-dot strip-${d.stress}`)
    .attr("cx", (d) => x(d.gpa))
    .attr("cy", () => y(0.5 + (Math.random() - 0.5) * jitter))
    .attr("r", 2.3)
    .attr("fill", (d) => STRESS_COLORS[d.stress])
    .attr("fill-opacity", 0.9)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.stress} stress</strong><br/>GPA: ${d.gpa.toFixed(
            2
          )}<br/>Study: ${d.study.toFixed(
            1
          )} hrs/day<br/>Sleep: ${d.sleep.toFixed(1)} hrs/day`
        );
    })
    .on("mousemove", (event) => positionTooltip(event, container, tooltip))
    .on("mouseout", () => tooltip.style("opacity", 0));

  drawInteractiveLegend(
    svg,
    STRESS_LEVELS,
    (d) => STRESS_COLORS[d],
    width,
    (stress, visible) => {
      svg
        .selectAll(`.strip-${stress}`)
        .style("display", visible ? null : "none");
    }
  );
}

// =====================================================
// STRESS & GPA – Donut + GPA by stress bar
// =====================================================

function drawStressDonut(raw) {
  const container = d3.select("#genz_donut_stress");
  if (container.empty()) return;

  const counts = d3.rollup(
    raw,
    (v) => v.length,
    (d) => d[COLS.stress]
  );

  const data = Array.from(counts, ([stress, count]) => ({ stress, count })).sort(
    (a, b) => {
      const order = { Low: 0, Moderate: 1, High: 2 };
      return (order[a.stress] ?? 99) - (order[b.stress] ?? 99);
    }
  );

  const width = 360;
  const height = 260;
  const radius = Math.min(width, height) / 2 - 20;

  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const color = d3
    .scaleOrdinal()
    .domain(data.map((d) => d.stress))
    .range(["#22c55e", "#eab308", "#f97316"]);

  const pie = d3
    .pie()
    .value((d) => d.count)
    .sort(null);

  const arc = d3
    .arc()
    .innerRadius(radius * 0.5)
    .outerRadius(radius);

  const tooltip = makeTooltip("#genz_donut_stress");

  svg
    .selectAll("path")
    .data(pie(data))
    .enter()
    .append("path")
    .attr("d", arc)
    .attr("fill", (d) => color(d.data.stress))
    .attr("stroke", "#0f0425")
    .attr("stroke-width", 2)
    .on("mouseover", (event, d) => {
      const total = d3.sum(data, (x) => x.count);
      const pct = ((d.data.count / total) * 100).toFixed(1);
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.data.stress} stress</strong><br>Students: ${d.data.count} (${pct}%)`
        );
    })
    .on("mousemove", (event) =>
      positionTooltip(event, d3.select("#genz_donut_stress"), tooltip)
    )
    .on("mouseout", () => tooltip.style("opacity", 0));

  const labelArc = d3
    .arc()
    .innerRadius(radius * 0.75)
    .outerRadius(radius * 0.75);

  svg
    .selectAll("text.label")
    .data(pie(data))
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("transform", (d) => `translate(${labelArc.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text((d) => d.data.stress);
}

function drawGpaByStress(raw) {
  const container = d3.select("#genz_box_gpa_stress");
  if (container.empty()) return;

  const groups = groupByStress(raw).map((g) => ({
    stress: g.stress,
    avgGpa: d3.mean(g.rows, (d) => toNum(d[COLS.gpa])),
  }));

  const width = 360;
  const height = 260;
  const margin = { top: 26, right: 100, bottom: 70, left: 80 };

  const svg = container.append("svg").attr("width", width).attr("height", height);

  const x = d3
    .scaleBand()
    .domain(groups.map((d) => d.stress))
    .range([margin.left, width - margin.right])
    .padding(0.35);

  const y = d3
    .scaleLinear()
    .domain([0, 4.0])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const colorScale = d3
    .scaleOrdinal()
    .domain(STRESS_LEVELS)
    .range(["#22c55e", "#eab308", "#f97316"]);

  const tooltip = makeTooltip(container);

  const bars = svg
    .selectAll("rect")
    .data(groups)
    .enter()
    .append("rect")
    .attr("x", (d) => x(d.stress))
    .attr("width", x.bandwidth())
    .attr("y", (d) => y(d.avgGpa))
    .attr("height", (d) => y(0) - y(d.avgGpa))
    .attr("fill", (d) => colorScale(d.stress))
    .attr("rx", 0)
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.stress} stress</strong><br>Average GPA: ${d.avgGpa.toFixed(
            2
          )}`
        );
    })
    .on("mousemove", (event) => positionTooltip(event, container, tooltip))
    .on("mouseout", () => tooltip.style("opacity", 0));

  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(5);

  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg
    .append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(yAxis)
    .selectAll("text")
    .style("fill", "#e0d7ff")
    .style("font-size", "11px");

  svg.selectAll("path.domain, .tick line").attr("stroke", "rgba(161,140,255,0.6)");

  svg
    .append("text")
    .attr("x", (width + margin.left - margin.right) / 2)
    .attr("y", height - margin.bottom + 30)
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text("Stress Level (Stress_Level)");

  svg
    .append("text")
    .attr("x", -(height - margin.bottom + margin.top) / 2)
    .attr("y", 24)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", "#f4f1ff")
    .style("font-size", "11px")
    .text(`Average GPA (${COLS.gpa})`);

  // interactive legend on the right side inside card
  const legend = svg
    .append("g")
    .attr("transform", `translate(${width - margin.right + 10}, ${margin.top})`);

  let selectedStress = null;
  const legendItems = [];

  STRESS_LEVELS.forEach((lvl, i) => {
    const g = legend.append("g").attr("transform", `translate(0,${i * 18})`);

    g.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("rx", 2)
      .attr("fill", colorScale(lvl));

    g.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .style("fill", "#f4f1ff")
      .style("font-size", "10px")
      .text(lvl);

    g.style("cursor", "pointer").on("click", (event) => {
      event.stopPropagation();
      selectedStress = selectedStress === lvl ? null : lvl;
      applyGpaHighlight();
    });

    legendItems.push({ lvl, g });
  });

  function applyGpaHighlight() {
    legendItems.forEach(({ lvl, g }) => {
      const active = selectedStress === null || selectedStress === lvl;
      g.select("rect").attr("fill-opacity", active ? 1 : 0.25);
      g.select("text").attr("fill-opacity", active ? 1 : 0.5);
    });

    bars.style("opacity", (d) => {
      if (selectedStress === null) return 1;
      return d.stress === selectedStress ? 1 : 0.2;
    });
  }

  svg.on("click.legendResetGpa", () => {
    if (selectedStress !== null) {
      selectedStress = null;
      applyGpaHighlight();
    }
  });

  applyGpaHighlight();
}
