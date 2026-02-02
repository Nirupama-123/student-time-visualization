// Distribution dashboards for Overall / Gen Z / Millennials / Stress-focused

const DATA_URL =
  "https://raw.githubusercontent.com/Nirupama-123/Students_lifestyle_dataset_1/refs/heads/main/combined_student_lifestyle_36000.csv";

// --- Palette ----------------------------------------------------
const COLORS = {
  study: "#3dd9ff",
  sleep: "#2ecc71",
  social: "#ff9933",
  activity: "#e266ff",
  genz: "#3dd9ff",
  mill: "#c56bff",
  stressLow: "#2ecc71",
  stressModerate: "#f1c40f",
  stressHigh: "#e74c3c"
};

// *** NEW: shared tooltip helper ***
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

document.addEventListener("DOMContentLoaded", () => {
  d3.csv(DATA_URL, d3.autoType).then((raw) => {
    const data = raw.map((d) => ({
      ...d,
      Study_Hours_Per_Day: +d.Study_Hours_Per_Day,
      Sleep_Hours_Per_Day: +d.Sleep_Hours_Per_Day,
      Social_Hours_Per_Day: +d.Social_Hours_Per_Day,
      Physical_Activity_Hours_Per_Day: +d.Physical_Activity_Hours_Per_Day,
      GPA: +d.GPA,
      Stress_Level: d.Stress_Level || d.Stress || "Moderate",
      Generation: d.Generation || d.Generation_Group || "Gen Z"
    }));

    const genZ = data.filter((d) => d.Generation === "Gen Z");
    const mill = data.filter((d) => d.Generation !== "Gen Z");

    renderOverall(data);
    renderGenZ(genZ);
    renderMillennials(mill);
    renderStressTab(data, genZ, mill);
  });
});

// ---------- Generic helpers ------------------------------------

// Responsive SVG that fits the card/container
function createSVG(containerSelector, { height = 320, margin } = {}) {
  const container = d3.select(containerSelector);
  if (container.empty()) return null;

  const node = container.node();
  const containerWidth =
    node.clientWidth || node.getBoundingClientRect().width || 520;

  const m = margin || { top: 35, right: 30, bottom: 55, left: 60 };

  // Clear previous content
  container.selectAll("*").remove();

  const svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${containerWidth} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg
    .append("g")
    .attr("transform", `translate(${m.left},${m.top})`);

  const innerWidth = containerWidth - m.left - m.right;
  const innerHeight = height - m.top - m.bottom;

  return { svg, g, innerWidth, innerHeight, margin: m, containerSelector }; // *** NEW: return containerSelector
}

function renderHistogram({
  container,
  data,
  accessor,
  color,
  xLabel,
  yLabel = "Number of students",
  binCount = 18
}) {
  const cfg = createSVG(container, { height: 320 });
  if (!cfg) return;
  const { g, innerWidth, innerHeight } = cfg;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const values = data.map(accessor).filter((v) => !Number.isNaN(v));

  const x = d3
    .scaleLinear()
    .domain(d3.extent(values))
    .nice()
    .range([0, innerWidth]);

  const bins = d3
    .bin()
    .domain(x.domain())
    .thresholds(binCount)(values);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.length) || 1])
    .nice()
    .range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.selectAll("rect.bar")
    .data(bins)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d.x0) + 1)
    .attr("y", (d) => y(d.length))
    .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
    .attr("height", (d) => innerHeight - y(d.length))
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("fill", color)
    .attr("opacity", 0.9)
    // *** NEW: tooltip for histogram bins ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Range: ${d.x0.toFixed(1)} – ${d.x1.toFixed(
            1
          )}<br>Students: ${d.length}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  // Axis labels
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text(xLabel);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text(yLabel);
}

// Scatter with legend in right margin (no overlap with plot)
function renderScatter({
  container,
  data,
  xAccessor,
  yAccessor,
  colorAccessor,
  xLabel,
  yLabel
}) {
  const cfg = createSVG(container, {
    height: 300,
    margin: { top: 40, right: 130, bottom: 55, left: 60 }
  });
  if (!cfg) return;
  const { svg, g, innerWidth, innerHeight, margin, containerSelector } = cfg;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const xs = data.map(xAccessor);
  const ys = data.map(yAccessor);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(xs))
    .nice()
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain(d3.extent(ys))
    .nice()
    .range([innerHeight, 0]);

  const stressOrder = ["Low", "Moderate", "High"];
  const colorScale = d3
    .scaleOrdinal()
    .domain(stressOrder)
    .range([COLORS.stressLow, COLORS.stressModerate, COLORS.stressHigh]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.selectAll("circle.dot")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d) => x(xAccessor(d)))
    .attr("cy", (d) => y(yAccessor(d)))
    .attr("r", 3)
    .attr("fill", (d) => colorScale(colorAccessor(d)))
    .attr("opacity", 0.75)
    .attr("data-stress", (d) => colorAccessor(d)) // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Study: ${xAccessor(d).toFixed(1)} hrs<br>GPA: ${yAccessor(
            d
          ).toFixed(2)}<br>Stress: ${colorAccessor(d)}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  // Labels
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text(xLabel);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text(yLabel);

  // Legend in right margin
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + innerWidth + 20},${margin.top})`
    );

  const legendItems = stressOrder.map((level, i) => {
    const row = legend
      .append("g")
      .attr("transform", `translate(0, ${i * 22})`)
      .attr("class", "legend-item") // *** NEW ***
      .attr("data-stress", level); // *** NEW ***

    row
      .append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", colorScale(level));

    row
      .append("text")
      .attr("x", 20)
      .attr("y", 11)
      .attr("fill", "#eee")
      .attr("font-size", 11)
      .text(level);

    return row;
  });

  // *** NEW: legend hover/click highlight ***
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    g.selectAll("[data-stress]").attr("opacity", function () {
      if (!key) return 0.75;
      const k = d3.select(this).attr("data-stress");
      return k === key ? 1 : 0.15;
    });

    legend.selectAll(".legend-item").each(function () {
      const row = d3.select(this);
      const k = row.attr("data-stress");
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (k === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems.forEach((row) => {
    row
      .on("mouseenter", function () {
        hoverKey = d3.select(this).attr("data-stress");
        applyHighlight();
      })
      .on("mouseleave", function () {
        hoverKey = null;
        applyHighlight();
      })
      .on("click", function () {
        const k = d3.select(this).attr("data-stress");
        activeKey = activeKey === k ? null : k;
        applyHighlight();
      });
  });

  // click outside container → clear highlight
  const containerSel = containerSelector;
  const containerNodeSel = d3.select(containerSel);
  if (!containerNodeSel.empty()) {
    document.addEventListener("click", (evt) => {
      if (!containerNodeSel.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

// ---------------- Overall tab ----------------------------------

function renderOverall(data) {
  renderHistogram({
    container: "#dist_overall_study",
    data,
    accessor: (d) => d.Study_Hours_Per_Day,
    color: COLORS.study,
    xLabel: "Study hours per day"
  });

  renderHistogram({
    container: "#dist_overall_sleep",
    data,
    accessor: (d) => d.Sleep_Hours_Per_Day,
    color: COLORS.sleep,
    xLabel: "Sleep hours per day"
  });

  renderHistogram({
    container: "#dist_overall_social",
    data,
    accessor: (d) => d.Social_Hours_Per_Day,
    color: COLORS.social,
    xLabel: "Social hours per day"
  });

  renderHistogram({
    container: "#dist_overall_activity",
    data,
    accessor: (d) => d.Physical_Activity_Hours_Per_Day,
    color: COLORS.activity,
    xLabel: "Physical activity hours per week"
  });
}

// ---------------- Gen Z tab ------------------------------------

function renderGenZ(genZ) {
  renderHistogram({
    container: "#dist_genz_study",
    data: genZ,
    accessor: (d) => d.Study_Hours_Per_Day,
    color: COLORS.study,
    xLabel: "Study hours per day (Gen Z)"
  });

  renderHistogram({
    container: "#dist_genz_sleep",
    data: genZ,
    accessor: (d) => d.Sleep_Hours_Per_Day,
    color: COLORS.sleep,
    xLabel: "Sleep hours per day (Gen Z)"
  });

  renderHistogram({
    container: "#dist_genz_gpa",
    data: genZ,
    accessor: (d) => d.GPA,
    color: COLORS.activity,
    xLabel: "GPA (Gen Z)"
  });

  renderScatter({
    container: "#dist_genz_scatter",
    data: genZ,
    xAccessor: (d) => d.Study_Hours_Per_Day,
    yAccessor: (d) => d.GPA,
    colorAccessor: (d) => d.Stress_Level,
    xLabel: "Study hours per day",
    yLabel: "GPA"
  });
}

// ---------------- Millennials tab ------------------------------

function renderMillennials(mill) {
  renderHistogram({
    container: "#dist_mill_study",
    data: mill,
    accessor: (d) => d.Study_Hours_Per_Day,
    color: COLORS.study,
    xLabel: "Study hours per day (Millennials)"
  });

  renderHistogram({
    container: "#dist_mill_sleep",
    data: mill,
    accessor: (d) => d.Sleep_Hours_Per_Day,
    color: COLORS.sleep,
    xLabel: "Sleep hours per day (Millennials)"
  });

  renderHistogram({
    container: "#dist_mill_gpa",
    data: mill,
    accessor: (d) => d.GPA,
    color: COLORS.activity,
    xLabel: "GPA (Millennials)"
  });

  renderScatter({
    container: "#dist_mill_scatter",
    data: mill,
    xAccessor: (d) => d.Study_Hours_Per_Day,
    yAccessor: (d) => d.GPA,
    colorAccessor: (d) => d.Stress_Level,
    xLabel: "Study hours per day",
    yLabel: "GPA"
  });
}

// ---------------- Stress-focused tab ---------------------------

function renderStressTab(allData, genZ, mill) {
  const pieContainer = "#dist_stress_pie";
  const heatContainer = "#dist_study_by_stress_heat";
  const stackedContainer = "#dist_sleep_by_stress_stack";

  renderStressPie(pieContainer, allData);
  renderStressHeatmap(heatContainer, allData);
  renderStressStacked(stackedContainer, genZ, mill);
}

function renderStressPie(container, data) {
  const cfg = createSVG(container, {
    height: 300,
    margin: { top: 20, right: 20, bottom: 60, left: 20 }
  });
  if (!cfg) return;
  const { svg, innerWidth, innerHeight, margin, containerSelector } = cfg;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const centerX = margin.left + innerWidth / 2;
  const centerY = margin.top + innerHeight / 2 - 10;
  const radius = Math.min(innerWidth, innerHeight) / 2.4;

  const counts = d3.rollup(
    data,
    (v) => v.length,
    (d) => d.Stress_Level
  );

  const levels = ["Low", "Moderate", "High"];
  const pieData = levels.map((l) => ({
    level: l,
    value: counts.get(l) || 0
  }));

  const pie = d3
    .pie()
    .value((d) => d.value)
    .sort(null);

  const arc = d3
    .arc()
    .innerRadius(0)
    .outerRadius(radius);

  const colorScale = d3
    .scaleOrdinal()
    .domain(levels)
    .range([COLORS.stressLow, COLORS.stressModerate, COLORS.stressHigh]);

  const g = svg
    .append("g")
    .attr("transform", `translate(${centerX},${centerY})`);

  const slices = g
    .selectAll("path.slice")
    .data(pie(pieData))
    .enter()
    .append("path")
    .attr("class", "slice")
    .attr("d", arc)
    .attr("fill", (d) => colorScale(d.data.level))
    .attr("stroke", "#0b0618")
    .attr("stroke-width", 2)
    .attr("data-level", (d) => d.data.level) // *** NEW ***
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Stress: ${d.data.level}<br>Students: ${d.data.value}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  // Legend under the pie
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + innerWidth / 2 - 120},${
        margin.top + innerHeight + 10
      })`
    );

  levels.forEach((level, i) => {
    const row = legend
      .append("g")
      .attr("transform", `translate(${i * 80},0)`)
      .attr("class", "legend-item") // *** NEW ***
      .attr("data-level", level); // *** NEW ***

    row
      .append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", colorScale(level));

    row
      .append("text")
      .attr("x", 22)
      .attr("y", 12)
      .attr("fill", "#eee")
      .attr("font-size", 11)
      .text(level);
  });

  // *** NEW: legend hover/click highlight for pie ***
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    slices.attr("opacity", function () {
      if (!key) return 1;
      const k = d3.select(this).attr("data-level");
      return k === key ? 1 : 0.2;
    });

    legend.selectAll(".legend-item").each(function () {
      const row = d3.select(this);
      const k = row.attr("data-level");
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (k === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legend.selectAll(".legend-item")
    .on("mouseenter", function () {
      hoverKey = d3.select(this).attr("data-level");
      applyHighlight();
    })
    .on("mouseleave", function () {
      hoverKey = null;
      applyHighlight();
    })
    .on("click", function () {
      const k = d3.select(this).attr("data-level");
      activeKey = activeKey === k ? null : k;
      applyHighlight();
    });

  const containerNodeSel = d3.select(containerSelector);
  if (!containerNodeSel.empty()) {
    document.addEventListener("click", (evt) => {
      if (!containerNodeSel.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}

function renderStressHeatmap(container, data) {
  const cfg = createSVG(container, {
    height: 300,
    margin: { top: 40, right: 20, bottom: 70, left: 70 }
  });
  if (!cfg) return;
  const { svg, g, innerWidth, innerHeight } = cfg;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  const bins = d3.range(1, 11);
  const stressLevels = ["Low", "Moderate", "High"];

  const countMap = d3.rollup(
    data,
    (v) => v.length,
    (d) => Math.round(d.Study_Hours_Per_Day),
    (d) => d.Stress_Level
  );

  const heatData = [];
  bins.forEach((b) => {
    stressLevels.forEach((level) => {
      const count =
        countMap.get(b) && countMap.get(b).get(level)
          ? countMap.get(b).get(level)
          : 0;
      heatData.push({ bin: b, level, value: count });
    });
  });

  const x = d3
    .scaleBand()
    .domain(bins)
    .range([0, innerWidth])
    .padding(0.05);

  const y = d3
    .scaleBand()
    .domain(stressLevels)
    .range([0, innerHeight])
    .padding(0.15);

  const maxVal = d3.max(heatData, (d) => d.value) || 1;

  const colorScale = d3
    .scaleLinear()
    .domain([0, maxVal])
    .range(["#3c1a5b", "#ff6666"]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.selectAll("rect.cell")
    .data(heatData)
    .enter()
    .append("rect")
    .attr("class", "cell")
    .attr("x", (d) => x(d.bin))
    .attr("y", (d) => y(d.level))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", (d) => colorScale(d.value))
    // *** NEW: tooltip ***
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `Study ~${d.bin} hrs<br>Stress: ${d.level}<br>Students: ${d.value}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  // Labels
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text("Study hours per day (binned)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text("Stress level");

  // Color legend
  const legendWidth = 160;
  const legendHeight = 10;
  const legendX = innerWidth / 2 - legendWidth / 2;
  const legendY = innerHeight + 20;

  const legend = g
    .append("g")
    .attr("transform", `translate(${legendX},${legendY})`);

  const gradId = "heatmap-gradient";
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", gradId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  gradient.append("stop").attr("offset", "0%").attr("stop-color", "#3c1a5b");
  gradient.append("stop").attr("offset", "100%").attr("stop-color", "#ff6666");

  legend
    .append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("rx", 5)
    .attr("ry", 5)
    .attr("fill", `url(#${gradId})`);

  legend
    .append("text")
    .attr("x", 0)
    .attr("y", legendHeight + 12)
    .attr("fill", "#ccc")
    .attr("font-size", 10)
    .text("Fewer students");

  legend
    .append("text")
    .attr("x", legendWidth)
    .attr("y", legendHeight + 12)
    .attr("text-anchor", "end")
    .attr("fill", "#ccc")
    .attr("font-size", 10)
    .text("More students");
}

// ----------- REAL STACKED AREA CHART FOR SLEEP × STRESS --------

function renderStressStacked(container, genZ, mill) {
  const cfg = createSVG(container, {
    height: 300,
    margin: { top: 40, right: 20, bottom: 55, left: 70 }
  });
  if (!cfg) return;
  const { g, innerWidth, innerHeight, containerSelector } = cfg;
  const tooltip = getGlobalTooltip(); // *** NEW ***

  // Sleep bins (4.0–10.0)
  const bins = d3.range(4, 10.5, 0.5);

  function binner(data) {
    const vals = data.map((d) => d.Sleep_Hours_Per_Day);
    return d3
      .bin()
      .domain(d3.extent(vals))
      .thresholds(bins)(vals);
  }

  const binsZ = binner(genZ);
  const binsM = binner(mill);

  // Data for stack: one object per bin
  const areaData = binsZ.map((bz, i) => ({
    x0: bz.x0,
    GenZ: bz.length,
    Millennials: binsM[i] ? binsM[i].length : 0
  }));

  const keys = ["GenZ", "Millennials"];

  const stack = d3.stack().keys(keys);
  const stackedSeries = stack(areaData);

  const x = d3
    .scaleLinear()
    .domain([bins[0], bins[bins.length - 1]])
    .range([0, innerWidth]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(areaData, (d) => d.GenZ + d.Millennials)])
    .nice()
    .range([innerHeight, 0]);

  const area = d3
    .area()
    .x((d) => x(d.data.x0))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(d3.curveMonotoneX); // smooth

  const colorMap = {
    GenZ: COLORS.genz,
    Millennials: COLORS.mill
  };

  // Draw stacked areas
  const layers = g
    .selectAll(".layer")
    .data(stackedSeries)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("d", area)
    .attr("fill", (d) => colorMap[d.key])
    .attr("opacity", 0.85)
    .attr("data-gen", (d) => d.key) // *** NEW ***
    // *** NEW: tooltip on area ***
    .on("mousemove", function (event, series) {
      const [mx] = d3.pointer(event, g.node());
      const xVal = x.invert(mx);
      // find nearest bin
      let nearest = series[0];
      let bestDist = Math.abs(series[0].data.x0 - xVal);
      for (let i = 1; i < series.length; i++) {
        const dist = Math.abs(series[i].data.x0 - xVal);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = series[i];
        }
      }
      const label = series.key === "GenZ" ? "Gen Z" : "Millennials";
      const students = series.key === "GenZ"
        ? nearest.data.GenZ
        : nearest.data.Millennials;

      tooltip
        .style("opacity", 1)
        .html(
          `Group: ${label}<br>Sleep ~${nearest.data.x0.toFixed(
            1
          )} hrs<br>Students: ${students}`
        )
        .style("left", event.clientX + 12 + "px")
        .style("top", event.clientY + 12 + "px");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
    .selectAll("text")
    .style("font-size", "11px");

  // Labels
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text("Sleep hours per day (binned)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -48)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text("Number of students (stacked)");

  // Legend (top-right)
  const legend = g
    .append("g")
    .attr("transform", `translate(${innerWidth - 130},${10})`);

  const legendItems = ["GenZ", "Millennials"].map((key, i) => {
    const row = legend
      .append("g")
      .attr("transform", `translate(0, ${i * 22})`)
      .attr("class", "legend-item") // *** NEW ***
      .attr("data-gen", key); // *** NEW ***

    row
      .append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", colorMap[key]);

    row
      .append("text")
      .attr("x", 22)
      .attr("y", 12)
      .attr("fill", "#eee")
      .attr("font-size", 11)
      .text(key === "GenZ" ? "Gen Z" : "Millennials");

    return row;
  });

  // *** NEW: legend hover/click highlight for stacked area ***
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    layers.attr("opacity", function () {
      if (!key) return 0.85;
      const k = d3.select(this).attr("data-gen");
      return k === key ? 0.95 : 0.2;
    });

    legend.selectAll(".legend-item").each(function () {
      const row = d3.select(this);
      const k = row.attr("data-gen");
      const rect = row.select("rect");
      if (!key) {
        rect.attr("opacity", 1).attr("stroke", "none");
      } else if (k === key) {
        rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
      } else {
        rect.attr("opacity", 0.3).attr("stroke", "none");
      }
    });
  }

  legendItems.forEach((row) => {
    row
      .on("mouseenter", function () {
        hoverKey = d3.select(this).attr("data-gen");
        applyHighlight();
      })
      .on("mouseleave", function () {
        hoverKey = null;
        applyHighlight();
      })
      .on("click", function () {
        const k = d3.select(this).attr("data-gen");
        activeKey = activeKey === k ? null : k;
        applyHighlight();
      });
  });

  const containerNodeSel = d3.select(containerSelector);
  if (!containerNodeSel.empty()) {
    document.addEventListener("click", (evt) => {
      if (!containerNodeSel.node().contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  applyHighlight();
}
