// js/compare.js
// Comparison dashboards for Gen Z vs Millennials using same layout
// style as distribution.js (responsive SVG, clean legends, no overlap)

const CMP_DATA_URL =
  "https://raw.githubusercontent.com/Nirupama-123/Students_lifestyle_dataset_1/refs/heads/main/combined_student_lifestyle_36000.csv";

const GEN_COLORS = {
  "Gen Z": "#3dd9ff",
  Millennials: "#c56bff"
};

const METRIC_COLORS = {
  study: "#3dd9ff",
  sleep: "#2ecc71",
  social: "#ff9933",
  activity: "#e266ff"
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
  d3.csv(CMP_DATA_URL, d3.autoType).then((raw) => {
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

    const gens = ["Gen Z", "Millennials"];

    renderKeyMetrics(data, gens);
    renderTimeUse(data, gens);
    renderStressGPA(data, gens);
    renderCorrelations(data, gens);
  });
});

// ---------- Generic helpers (same style as distribution.js) -----

function createSVG(containerSelector, { height = 320, margin } = {}) {
  const container = d3.select(containerSelector);
  if (container.empty()) return null;

  const node = container.node();
  const containerWidth =
    node.clientWidth || node.getBoundingClientRect().width || 520;

  const m = margin || { top: 40, right: 30, bottom: 55, left: 60 };

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

  return { svg, g, innerWidth, innerHeight, margin: m };
}

function addAxisLabels(g, innerWidth, innerHeight, xText, yText) {
  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 40)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text(xText);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .attr("fill", "#ccc")
    .attr("font-size", 11)
    .text(yText);
}

function meanByGen(data, gens, accessor) {
  return gens.map((g) =>
    d3.mean(
      data.filter((d) => d.Generation === g),
      accessor
    )
  );
}

// *** NEW: helper for gen-based highlight (used by legends) ***
function setupGenLegendInteractivity(legendRoot, svg, containerSelector) {
  const container = containerSelector ? d3.select(containerSelector) : null;
  const svgNode = svg.node();
  let activeKey = null;
  let hoverKey = null;

  function currentKey() {
    return activeKey || hoverKey || null;
  }

  function applyHighlight() {
    const key = currentKey();
    const shapes = d3.select(svgNode).selectAll("[data-gen]");

    shapes.attr("opacity", function () {
      if (!key) return 0.9;
      const k = d3.select(this).attr("data-gen");
      return k === key ? 1 : 0.15;
    });

    // legend appearance
    legendRoot.selectAll(".legend-item-gen").each(function () {
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

  // click outside container → clear highlight
  if (container && !container.empty()) {
    document.addEventListener("click", (evt) => {
      const node = container.node();
      if (!node.contains(evt.target)) {
        activeKey = null;
        hoverKey = null;
        applyHighlight();
      }
    });
  }

  return {
    bindRow(rowSelection, keyValue) {
      rowSelection
        .on("mouseenter", () => {
          hoverKey = keyValue;
          applyHighlight();
        })
        .on("mouseleave", () => {
          hoverKey = null;
          applyHighlight();
        })
        .on("click", () => {
          activeKey = activeKey === keyValue ? null : keyValue;
          applyHighlight();
        });
    },
    // initialize default opacity
    init() {
      applyHighlight();
    }
  };
}

// Legend for Gen Z / Millennials in right margin (outside plot)
function addGenLegendRight(svg, innerWidth, margin, colorScale, gens, containerSelector) {
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left + innerWidth + 20},${margin.top})`
    );

  const inter = setupGenLegendInteractivity(legend, svg, containerSelector);

  gens.forEach((g, i) => {
    const row = legend
      .append("g")
      .attr("class", "legend-item-gen")
      .attr("data-gen", g)
      .attr("transform", `translate(0,${i * 22})`);

    row
      .append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", colorScale(g));

    row
      .append("text")
      .attr("x", 20)
      .attr("y", 11)
      .attr("fill", "#eee")
      .attr("font-size", 11)
      .text(g);

    // *** NEW: legend hover/click bind ***
    inter.bindRow(row, g);
  });

  inter.init();
}

// Legend inside top-right of plotting area
function addGenLegendTopRight(g, innerWidth, colorScale, gens, containerSelector) {
  const legend = g
    .append("g")
    .attr("transform", `translate(${innerWidth - 130},${0})`);

  const svg = d3.select(g.node().ownerSVGElement);
  const inter = setupGenLegendInteractivity(legend, svg, containerSelector);

  gens.forEach((gen, i) => {
    const row = legend
      .append("g")
      .attr("class", "legend-item-gen")
      .attr("data-gen", gen)
      .attr("transform", `translate(0,${i * 22})`);

    row
      .append("rect")
      .attr("width", 16)
      .attr("height", 16)
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("fill", colorScale(gen));

    row
      .append("text")
      .attr("x", 22)
      .attr("y", 12)
      .attr("fill", "#eee")
      .attr("font-size", 11)
      .text(gen);

    // *** NEW: legend hover/click bind ***
    inter.bindRow(row, gen);
  });

  inter.init();
}

// ====================================================================
//  KEY METRICS
// ====================================================================

function renderKeyMetrics(data, gens) {
  // --- Average Study/Sleep/Social grouped by generation ---
  {
    const containerSel = "#cmp_bar_core_hours_by_gen";
    const cfg = createSVG(containerSel, {
      height: 320,
      margin: { top: 40, right: 120, bottom: 55, left: 60 }
    });
    if (!cfg) return;
    const { svg, g, innerWidth, innerHeight, margin } = cfg;
    const tooltip = getGlobalTooltip(); // *** NEW ***

    const metrics = [
      { key: "Study_Hours_Per_Day", label: "Study", colorKey: "study" },
      { key: "Sleep_Hours_Per_Day", label: "Sleep", colorKey: "sleep" },
      { key: "Social_Hours_Per_Day", label: "Social", colorKey: "social" }
    ];

    const rows = [];
    metrics.forEach((m) => {
      const [genZ, mill] = meanByGen(data, gens, (d) => d[m.key]);
      rows.push(
        { metric: m.label, gen: "Gen Z", value: genZ },
        { metric: m.label, gen: "Millennials", value: mill }
      );
    });

    const x0 = d3
      .scaleBand()
      .domain(metrics.map((m) => m.label))
      .range([0, innerWidth])
      .padding(0.3);

    const x1 = d3
      .scaleBand()
      .domain(gens)
      .range([0, x0.bandwidth()])
      .padding(0.15);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) || 1])
      .nice()
      .range([innerHeight, 0]);

    const colorScale = d3.scaleOrdinal().domain(gens).range([
      GEN_COLORS["Gen Z"],
      GEN_COLORS["Millennials"]
    ]);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    const groups = g
      .selectAll(".metric-group")
      .data(metrics)
      .enter()
      .append("g")
      .attr("class", "metric-group")
      .attr("transform", (d) => `translate(${x0(d.label)},0)`);

    groups
      .selectAll("rect")
      .data((m) => rows.filter((r) => r.metric === m.label))
      .enter()
      .append("rect")
      .attr("x", (d) => x1(d.gen))
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => innerHeight - y(d.value))
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", (d) => colorScale(d.gen))
      .attr("data-gen", (d) => d.gen) // *** NEW ***
      .attr("opacity", 0.9) // *** NEW default ***
      // *** NEW: tooltip for bars ***
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `Metric: ${d.metric}<br>Generation: ${d.gen}<br>Avg hours: ${d.value.toFixed(
              2
            )}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(g, innerWidth, innerHeight, "Metric", "Average hours per day");

    addGenLegendRight(svg, innerWidth, margin, colorScale, gens, containerSel);
  }

  // --- Average GPA by generation ---
  {
    const containerSel = "#cmp_bar_gpa_by_gen";
    const cfg = createSVG(containerSel, {
      height: 320,
      margin: { top: 40, right: 120, bottom: 55, left: 60 }
    });
    if (!cfg) return;
    const { svg, g, innerWidth, innerHeight, margin } = cfg;
    const tooltip = getGlobalTooltip(); // *** NEW ***

    const rows = gens.map((gen) => ({
      gen,
      value: d3.mean(
        data.filter((d) => d.Generation === gen),
        (d) => d.GPA
      )
    }));

    const x = d3
      .scaleBand()
      .domain(gens)
      .range([0, innerWidth])
      .padding(0.35);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) || 1])
      .nice()
      .range([innerHeight, 0]);

    const colorScale = d3
      .scaleOrdinal()
      .domain(gens)
      .range(["#2ecc71", "#ff9933"]);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.selectAll("rect")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.gen))
      .attr("y", (d) => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerHeight - y(d.value))
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", (d) => colorScale(d.gen))
      .attr("data-gen", (d) => d.gen) // *** NEW ***
      .attr("opacity", 0.9) // *** NEW ***
      // *** NEW: tooltip ***
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `Generation: ${d.gen}<br>Average GPA: ${d.value.toFixed(2)}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(g, innerWidth, innerHeight, "Generation", "Average GPA");

    addGenLegendRight(svg, innerWidth, margin, colorScale, gens, containerSel);
  }
}

// ====================================================================
//  TIME USE
// ====================================================================

function renderTimeUse(data, gens) {
  // --- Stacked totals per day (Study/Sleep/Social/Activity) per generation ---
  {
    const containerSel = "#cmp_stacked_time_by_gen";
    const cfg = createSVG(containerSel, {
      height: 320,
      margin: { top: 30, right: 160, bottom: 55, left: 70 }
    });
    if (!cfg) return;
    const { g, innerWidth, innerHeight } = cfg;
    const tooltip = getGlobalTooltip(); // *** NEW ***

    const metrics = [
      "Study_Hours_Per_Day",
      "Sleep_Hours_Per_Day",
      "Social_Hours_Per_Day",
      "Physical_Activity_Hours_Per_Day"
    ];

    const metricLabels = {
      Study_Hours_Per_Day: "Study",
      Sleep_Hours_Per_Day: "Sleep",
      Social_Hours_Per_Day: "Social",
      Physical_Activity_Hours_Per_Day: "Physical Activity"
    };

    const aggregated = gens.map((gen) => {
      const subset = data.filter((d) => d.Generation === gen);
      const obj = { Generation: gen };
      metrics.forEach(
        (m) => (obj[m] = d3.mean(subset, (d) => d[m] || 0))
      );
      return obj;
    });

    const stack = d3.stack().keys(metrics)(aggregated);

    const x = d3
      .scaleBand()
      .domain(gens)
      .range([0, innerWidth])
      .padding(0.3);
// calculate max total hours (Study + Sleep + Social + Physical)
const maxTotal =
  d3.max(aggregated, (d) =>
    metrics.reduce((sum, m) => sum + d[m], 0)
  ) || 1;

// Add 15% headroom so stacked bars don’t reach the legend
const y = d3.scaleLinear()
  .domain([0, maxTotal * 1.15])
  .nice()
  .range([innerHeight, 0]);
    
    const colorScale = d3
      .scaleOrdinal()
      .domain(metrics)
      .range([
        METRIC_COLORS.study,
        METRIC_COLORS.sleep,
        METRIC_COLORS.social,
        METRIC_COLORS.activity
      ]);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    const groups = g
      .selectAll(".stack-layer")
      .data(stack)
      .enter()
      .append("g")
      .attr("fill", (d) => colorScale(d.key));

    groups
      .selectAll("rect")
      .data((d) => d)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.data.Generation))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("data-metric", function () { // *** NEW ***
        return d3.select(this.parentNode).datum().key;
      })
      .attr("opacity", 0.9) // *** NEW ***
      // *** NEW: tooltip for stacked bars ***
      .on("mousemove", function (event, d) {
        const metricKey = d3.select(this).attr("data-metric");
        const label = metricLabels[metricKey] || metricKey;
        const value = d[1] - d[0];
        tooltip
          .style("opacity", 1)
          .html(
            `Generation: ${d.data.Generation}<br>Metric: ${label}<br>Avg hours: ${value.toFixed(
              2
            )}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(
      g,
      innerWidth,
      innerHeight,
      "Generation",
      "Average hours per day"
    );

    // metric legend TOP-RIGHT inside chart area (no overlap with axes)
    const legend = g
      .append("g")
      .attr("transform", `translate(${cfg.innerWidth + cfg.margin.left - 110}, 10)`);

    // *** NEW: metric-highlight interactivity ***
    let metricActive = null;
    let metricHover = null;

    function currentMetric() {
      return metricActive || metricHover || null;
    }

    function applyMetricHighlight() {
      const key = currentMetric();
      g.selectAll("[data-metric]").attr("opacity", function () {
        if (!key) return 0.9;
        const mk = d3.select(this).attr("data-metric");
        return mk === key ? 1 : 0.15;
      });

      legend.selectAll(".legend-item-metric").each(function () {
        const row = d3.select(this);
        const mk = row.attr("data-metric");
        const rect = row.select("rect");
        if (!key) {
          rect.attr("opacity", 1).attr("stroke", "none");
        } else if (mk === key) {
          rect.attr("opacity", 1).attr("stroke", "#fff").attr("stroke-width", 1);
        } else {
          rect.attr("opacity", 0.3).attr("stroke", "none");
        }
      });
    }

    // click outside container → clear metric highlight
    const container = d3.select(containerSel);
    if (!container.empty()) {
      document.addEventListener("click", (evt) => {
        if (!container.node().contains(evt.target)) {
          metricActive = null;
          metricHover = null;
          applyMetricHighlight();
        }
      });
    }

    metrics.forEach((m, i) => {
      const row = legend
        .append("g")
        .attr("class", "legend-item-metric")
        .attr("data-metric", m)
        .attr("transform", `translate(0,${i * 18})`);

      row
        .append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", colorScale(m));

      row
        .append("text")
        .attr("x", 18)
        .attr("y", 10)
        .attr("fill", "#eee")
        .attr("font-size", 11)
        .text(metricLabels[m]);

      row
        .on("mouseenter", () => {
          metricHover = m;
          applyMetricHighlight();
        })
        .on("mouseleave", () => {
          metricHover = null;
          applyMetricHighlight();
        })
        .on("click", () => {
          metricActive = metricActive === m ? null : m;
          applyMetricHighlight();
        });
    });

    applyMetricHighlight();
  }

  // --- Grouped Study vs Social by generation ---
  {
    const containerSel = "#cmp_grouped_study_social";
    const cfg = createSVG(containerSel, {
      height: 320,
      margin: { top: 40, right: 120, bottom: 55, left: 60 }
    });
    if (!cfg) return;
    const { svg, g, innerWidth, innerHeight, margin } = cfg;
    const tooltip = getGlobalTooltip(); // *** NEW ***

    const metrics = [
      { key: "Study_Hours_Per_Day", label: "Study" },
      { key: "Social_Hours_Per_Day", label: "Social" }
    ];

    const rows = [];
    metrics.forEach((m) => {
      const [genZ, mill] = meanByGen(data, gens, (d) => d[m.key]);
      rows.push(
        { metric: m.label, gen: "Gen Z", value: genZ },
        { metric: m.label, gen: "Millennials", value: mill }
      );
    });

    const x0 = d3
      .scaleBand()
      .domain(metrics.map((m) => m.label))
      .range([0, innerWidth])
      .padding(0.3);

    const x1 = d3
      .scaleBand()
      .domain(gens)
      .range([0, x0.bandwidth()])
      .padding(0.15);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.value) || 1])
      .nice()
      .range([innerHeight, 0]);

    const colorScale = d3
      .scaleOrdinal()
      .domain(gens)
      .range([GEN_COLORS["Gen Z"], GEN_COLORS["Millennials"]]);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    const groups = g
      .selectAll(".metric-group")
      .data(metrics)
      .enter()
      .append("g")
      .attr("class", "metric-group")
      .attr("transform", (d) => `translate(${x0(d.label)},0)`);

    groups
      .selectAll("rect")
      .data((m) => rows.filter((r) => r.metric === m.label))
      .enter()
      .append("rect")
      .attr("x", (d) => x1(d.gen))
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => innerHeight - y(d.value))
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", (d) => colorScale(d.gen))
      .attr("data-gen", (d) => d.gen) // *** NEW ***
      .attr("opacity", 0.9) // *** NEW ***
      // *** NEW: tooltip ***
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `Metric: ${d.metric}<br>Generation: ${d.gen}<br>Avg hours: ${d.value.toFixed(
              2
            )}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(g, innerWidth, innerHeight, "Metric", "Average hours per day");

    addGenLegendRight(svg, innerWidth, margin, colorScale, gens, containerSel);
  }
}

// ====================================================================
//  STRESS & GPA
// ====================================================================

function renderStressGPA(data, gens) {
  const levels = ["Low", "Moderate", "High"];

  // ----- stacked stress distribution by generation -----
  {
    const containerSel = "#cmp_bar_stress_distribution";
    const cfg = createSVG(containerSel, {
      height: 320,
      margin: { top: 40, right: 30, bottom: 55, left: 70 }
    });
    if (!cfg) return;
    const { g, innerWidth, innerHeight } = cfg;
    const tooltip = getGlobalTooltip(); // *** NEW ***

    const rows = levels.map((level) => {
      const genZCount = data.filter(
        (d) => d.Generation === "Gen Z" && d.Stress_Level === level
      ).length;
      const millCount = data.filter(
        (d) => d.Generation === "Millennials" && d.Stress_Level === level
      ).length;
      return { level, "Gen Z": genZCount, Millennials: millCount };
    });

    const stack = d3.stack().keys(gens)(rows);

    const x = d3
      .scaleBand()
      .domain(levels)
      .range([0, innerWidth])
      .padding(0.35);

    const y = d3
      .scaleLinear()
      .domain([
        0,
        d3.max(rows, (d) => d["Gen Z"] + d["Millennials"]) || 1
      ])
      .nice()
      .range([innerHeight, 0]);

    const colorScale = d3
      .scaleOrdinal()
      .domain(gens)
      .range([GEN_COLORS["Gen Z"], GEN_COLORS["Millennials"]]);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    const seriesGroups = g
      .selectAll(".stack-series")
      .data(stack)
      .enter()
      .append("g")
      .attr("fill", (d) => colorScale(d.key));

    seriesGroups
      .selectAll("rect")
      .data((d) => d)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.data.level))
      .attr("y", (d) => y(d[1]))
      .attr("height", (d) => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth())
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("data-gen", function () { // *** NEW ***
        return d3.select(this.parentNode).datum().key;
      })
      .attr("opacity", 0.9) // *** NEW ***
      // *** NEW: tooltip ***
      .on("mousemove", function (event, d) {
        const gen = d3.select(this.parentNode).datum().key;
        const count = d[1] - d[0];
        tooltip
          .style("opacity", 1)
          .html(
            `Stress level: ${d.data.level}<br>Generation: ${gen}<br>Students: ${count}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(
      g,
      innerWidth,
      innerHeight,
      "Stress level",
      "Number of students"
    );

    addGenLegendTopRight(g, innerWidth, colorScale, gens, containerSel);
  }

  // ----- GPA by Stress & Generation (grouped bars) -----
  {
    const containerSel = "#cmp_gpa_by_stress_gen";
    const cfg = createSVG(containerSel, {
      height: 320,
      margin: { top: 40, right: 120, bottom: 55, left: 70 }
    });
    if (!cfg) return;
    const { svg, g, innerWidth, innerHeight, margin } = cfg;
    const tooltip = getGlobalTooltip(); // *** NEW ***

    const levels = ["Low", "Moderate", "High"];

    const rows = [];
    gens.forEach((gen) => {
      levels.forEach((level) => {
        const subset = data.filter(
          (d) => d.Generation === gen && d.Stress_Level === level
        );
        rows.push({
          gen,
          level,
          value: d3.mean(subset, (d) => d.GPA) || 0
        });
      });
    });

    const x0 = d3
      .scaleBand()
      .domain(levels)
      .range([0, innerWidth])
      .padding(0.3);

    const x1 = d3
      .scaleBand()
      .domain(gens)
      .range([0, x0.bandwidth()])
      .padding(0.15);

    const y = d3
      .scaleLinear()
      .domain([2, 3.5])
      .nice()
      .range([innerHeight, 0]);

    const colorScale = d3
      .scaleOrdinal()
      .domain(gens)
      .range([GEN_COLORS["Gen Z"], GEN_COLORS["Millennials"]]);

    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .selectAll("text")
      .style("font-size", "11px");

    const groups = g
      .selectAll(".stress-group")
      .data(levels)
      .enter()
      .append("g")
      .attr("transform", (d) => `translate(${x0(d)},0)`);

    groups
      .selectAll("rect")
      .data((level) => rows.filter((r) => r.level === level))
      .enter()
      .append("rect")
      .attr("x", (d) => x1(d.gen))
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => innerHeight - y(d.value))
      .attr("rx", 5)
      .attr("ry", 5)
      .attr("fill", (d) => colorScale(d.gen))
      .attr("data-gen", (d) => d.gen) // *** NEW ***
      .attr("opacity", 0.9) // *** NEW ***
      // *** NEW: tooltip ***
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `Stress level: ${d.level}<br>Generation: ${d.gen}<br>Average GPA: ${d.value.toFixed(
              2
            )}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(
      g,
      innerWidth,
      innerHeight,
      "Stress level",
      "Average GPA"
    );

    addGenLegendRight(svg, innerWidth, margin, colorScale, gens, containerSel);
  }
}

// ====================================================================
//  CORRELATIONS
// ====================================================================

function renderCorrelations(data, gens) {
  // Sample for performance
  const maxPoints = 12000;
  const all =
    data.length > maxPoints ? d3.shuffle(data.slice()).slice(0, maxPoints) : data;

  function renderScatterByGen({
    container,
    xAccessor,
    yAccessor,
    xLabel,
    yLabel
  }) {
    const cfg = createSVG(container, {
      height: 300,
      margin: { top: 40, right: 130, bottom: 55, left: 60 }
    });
    if (!cfg) return;
    const { svg, g, innerWidth, innerHeight, margin } = cfg;
    const tooltip = getGlobalTooltip(); // *** UPDATED: shared tooltip ***

    const xs = all.map(xAccessor);
    const ys = all.map(yAccessor);

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

    const colorScale = d3
      .scaleOrdinal()
      .domain(gens)
      .range([GEN_COLORS["Gen Z"], GEN_COLORS["Millennials"]]);

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
      .data(all)
      .enter()
      .append("circle")
      .attr("class", "dot")
      .attr("cx", (d) => x(xAccessor(d)))
      .attr("cy", (d) => y(yAccessor(d)))
      .attr("r", 3)
      .attr("fill", (d) => colorScale(d.Generation))
      .attr("opacity", 0.75)
      .attr("data-gen", (d) => d.Generation) // *** NEW for highlight ***
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(
            `${xLabel}: ${xAccessor(d).toFixed(2)}<br>${yLabel}: ${yAccessor(
              d
            ).toFixed(2)}<br>Generation: ${d.Generation}`
          )
          .style("left", event.clientX + 12 + "px")
          .style("top", event.clientY + 12 + "px");
      })
      .on("mouseleave", () => {
        tooltip.style("opacity", 0);
      });

    addAxisLabels(g, innerWidth, innerHeight, xLabel, yLabel);

    addGenLegendRight(svg, innerWidth, margin, colorScale, gens, container);
  }

  renderScatterByGen({
    container: "#cmp_scatter_study_sleep_gen",
    xAccessor: (d) => d.Study_Hours_Per_Day,
    yAccessor: (d) => d.Sleep_Hours_Per_Day,
    xLabel: "Study hours per day",
    yLabel: "Sleep hours per day"
  });

  renderScatterByGen({
    container: "#cmp_scatter_activity_gpa_gen",
    xAccessor: (d) => d.Physical_Activity_Hours_Per_Day,
    yAccessor: (d) => d.GPA,
    xLabel: "Physical activity hours per day",
    yLabel: "GPA"
  });
}
