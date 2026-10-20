function getDisplayName(user) {
  if (!user) {
    return "utente";
  }

  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  if (typeof user.email === "string" && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  return "utente";
}

function getSafeNextPath() {
  const requestedPath = new URLSearchParams(window.location.search).get("next");
  const allowedPaths = new Set(["dashboard.html"]);

  if (requestedPath && allowedPaths.has(requestedPath)) {
    return requestedPath;
  }

  return "dashboard.html";
}

function showMessage(element, message, type = "info") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = `alert alert-${type}`;
  element.hidden = false;
}

function hideMessage(element) {
  if (!element) {
    return;
  }

  element.textContent = "";
  element.hidden = true;
}

function showGlobalNotice(message, type = "error") {
  const host = document.getElementById("config-notice");
  if (!host) {
    return;
  }

  let notice = document.getElementById("page-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "page-notice";
    host.insertAdjacentElement("afterend", notice);
  }

  notice.className = `alert alert-${type}`;
  notice.setAttribute("role", type === "error" ? "alert" : "status");
  notice.textContent = message;
  notice.hidden = false;
}

function setLoading(button, isLoading, loadingText = "Attendi…") {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }

  button.textContent = button.dataset.originalText ?? "Invia";
  delete button.dataset.originalText;
  button.disabled = false;
  button.removeAttribute("aria-busy");
}

function setNavState(session) {
  document.querySelectorAll("[data-auth]").forEach((element) => {
    const isUserArea = element.dataset.auth === "user";
    element.hidden = isUserArea ? !session : Boolean(session);
  });

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = session ? getDisplayName(session.user) : "";
  });
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toDate(value) {
  if (!value) {
    return null;
  }

  const dateOnly = parseDateOnly(value);
  if (dateOnly) {
    return dateOnly;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) {
    return "—";
  }

  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysSince(value) {
  const date = parseDateOnly(value);
  if (!date) {
    return null;
  }

  const today = new Date();
  const startUtc = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return Math.floor((todayUtc - startUtc) / 86_400_000);
}

function formatNumber(value, maximumFractionDigits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits,
  }).format(number);
}

function hasNumericValue(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatWeight(value) {
  return hasNumericValue(value) && Number.isFinite(Number(value))
    ? `${formatNumber(value)} kg`
    : "—";
}

function formatCm(value) {
  return hasNumericValue(value) && Number.isFinite(Number(value))
    ? `${formatNumber(value)} cm`
    : "—";
}

function formatSignedWeight(value) {
  if (!hasNumericValue(value)) {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  const formatted = new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(number);

  return `${formatted} kg`;
}

function parseOptionalNumber(input) {
  const value = input?.value?.trim();
  if (!value) {
    return null;
  }

  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function svgNode(tagName, attributes = {}) {
  const element = document.createElementNS(
    "http://www.w3.org/2000/svg",
    tagName,
  );

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });

  return element;
}

function renderWeightChart(container, measurements) {
  if (!container) {
    return;
  }

  const points = (measurements ?? [])
    .map((entry) => {
      const date = parseDateOnly(entry.measured_on);
      const weight = Number(entry.weight_kg);

      if (!date || !Number.isFinite(weight)) {
        return null;
      }

      return {
        date,
        weight,
        time: date.getTime(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  container.replaceChildren();

  if (points.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-inline";
    empty.textContent = "Nessuna misurazione del peso disponibile.";
    container.append(empty);
    return;
  }

  const width = 640;
  const height = 240;
  const padding = { top: 22, right: 24, bottom: 38, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const weights = points.map((point) => point.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = Math.max(maxWeight - minWeight, 2);
  const yMin = Math.max(0, minWeight - weightRange * 0.2);
  const yMax = maxWeight + weightRange * 0.2;
  const ySpan = yMax - yMin || 1;

  const minTime = points[0].time;
  const maxTime = points[points.length - 1].time;
  const timeSpan = maxTime - minTime;

  const xFor = (point, index) => {
    if (points.length === 1 || timeSpan === 0) {
      return padding.left + plotWidth / 2;
    }

    return padding.left + ((point.time - minTime) / timeSpan) * plotWidth;
  };

  const yFor = (weight) =>
    padding.top + ((yMax - weight) / ySpan) * plotHeight;

  const svg = svgNode("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "weight-chart-svg",
    role: "img",
    "aria-label": `Grafico del peso: da ${formatNumber(
      points[0].weight,
    )} kg a ${formatNumber(points[points.length - 1].weight)} kg, su ${
      points.length
    } misurazioni.`,
  });

  const gridValues = [yMax, yMin + ySpan / 2, yMin];

  gridValues.forEach((value) => {
    const y = yFor(value);

    svg.append(
      svgNode("line", {
        x1: padding.left,
        x2: width - padding.right,
        y1: y,
        y2: y,
        class: "chart-grid-line",
      }),
    );

    const label = svgNode("text", {
      x: padding.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    label.textContent = `${formatNumber(value)}`;
    svg.append(label);
  });

  if (points.length > 1) {
    const polyline = svgNode("polyline", {
      points: points
        .map((point, index) => `${xFor(point, index)},${yFor(point.weight)}`)
        .join(" "),
      class: "chart-line",
    });
    svg.append(polyline);
  }

  points.forEach((point, index) => {
    const x = xFor(point, index);
    const y = yFor(point.weight);
    const circle = svgNode("circle", {
      cx: x,
      cy: y,
      r: 4.5,
      class: "chart-point",
    });
    const title = svgNode("title");
    title.textContent = `${formatDate(point.date)} — ${formatWeight(
      point.weight,
    )}`;
    circle.append(title);
    svg.append(circle);
  });

  const firstLabel = svgNode("text", {
    x: padding.left,
    y: height - 12,
    "text-anchor": "start",
    class: "chart-axis-label",
  });
  firstLabel.textContent = formatDate(points[0].date);
  svg.append(firstLabel);

  if (points.length > 1) {
    const lastLabel = svgNode("text", {
      x: width - padding.right,
      y: height - 12,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    lastLabel.textContent = formatDate(points[points.length - 1].date);
    svg.append(lastLabel);
  }

  container.append(svg);
}

function handleUrlAuthNotices() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const error = searchParams.get("error") || hashParams.get("error");

  if (error) {
    const description =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      "Il link potrebbe essere scaduto. Accedi di nuovo o richiedine uno nuovo.";

    window.NutriTrack.authLinkError = description;
    showGlobalNotice(
      `Non siamo riusciti a completare il link di accesso. ${description}`,
      "error",
    );

    const next = searchParams.get("next");
    const cleanUrl =
      window.location.pathname + (next ? `?next=${encodeURIComponent(next)}` : "");
    window.history.replaceState(null, "", cleanUrl);
    return;
  }

  if (searchParams.get("session_expired") === "1") {
    showGlobalNotice("La sessione è terminata. Accedi di nuovo.", "error");

    const next = searchParams.get("next");
    const cleanUrl =
      window.location.pathname + (next ? `?next=${encodeURIComponent(next)}` : "");
    window.history.replaceState(null, "", cleanUrl);
    return;
  }

  if (searchParams.get("logged_out") === "1") {
    showGlobalNotice("Sei uscito dal tuo account.", "success");
    window.history.replaceState(null, "", window.location.pathname);
  }
}

function bindLogoutButtons() {
  document.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener("click", async () => {
      if (!supabaseClient) {
        return;
      }

      button.disabled = true;
      window.NutriTrack.isLoggingOut = true;

      try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
          throw error;
        }

        window.location.assign("login.html?logged_out=1");
      } catch (error) {
        window.NutriTrack.isLoggingOut = false;
        console.error("Logout failed:", error);
        button.disabled = false;
        showGlobalNotice(
          "Non siamo riusciti a disconnetterti. Controlla la connessione e riprova.",
          "error",
        );
      }
    });
  });
}

async function initNavigation() {
  if (!supabaseClient) {
    setNavState(null);
    return;
  }

  try {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Could not restore the session:", error);
    }

    setNavState(session);
  } catch (error) {
    console.error("Could not restore the session:", error);
    setNavState(null);
  }

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    setNavState(session);
  });
}

function initConfigNotice() {
  const notice = document.getElementById("config-notice");

  if (!notice) {
    return;
  }

  if (isSupabaseConfigured) {
    notice.hidden = true;
    return;
  }

  notice.textContent =
    "Supabase non è ancora configurato. Aggiungi l'URL del progetto e la publishable key in js/config.js, poi esegui db.sql nel progetto Supabase.";
  notice.hidden = false;
}

window.NutriTrack = {
  getDisplayName,
  getSafeNextPath,
  showMessage,
  hideMessage,
  showGlobalNotice,
  setLoading,
  formatDate,
  formatNumber,
  formatWeight,
  formatCm,
  formatSignedWeight,
  todayInputValue,
  daysSince,
  parseOptionalNumber,
  renderWeightChart,
  isLoggingOut: false,
  authLinkError: "",
};

initConfigNotice();
handleUrlAuthNotices();
bindLogoutButtons();
initNavigation();
