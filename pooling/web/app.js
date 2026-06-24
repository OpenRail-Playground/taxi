const form = document.getElementById("upload-form");
const fileInput = document.getElementById("csv-file");
const submitButton = document.getElementById("submit-button");
const statusMessage = document.getElementById("status-message");
const emptyState = document.getElementById("empty-state");
const summary = document.getElementById("summary");
const summaryCards = document.getElementById("summary-cards");
const poolGroups = document.getElementById("pool-groups");
const resultsPanel = document.getElementById("results-panel");
const resultsTableBody = document.querySelector("#results-table tbody");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files?.[0];
  if (!file) {
    showMessage("Bitte zuerst eine CSV-Datei auswählen.", "error");
    return;
  }

  setLoadingState(true);
  showMessage("CSV wird hochgeladen und Pooling wird berechnet …", "informative");

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/pool-taxis", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = typeof payload.detail === "string" ? payload.detail : "Unbekannter Fehler";
      showMessage(detail, "error");
      clearResults();
      return;
    }

    renderResults(payload);
    showMessage(`Pooling erfolgreich berechnet (${payload.length} Fahrten).`, "success");
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Die Berechnung ist fehlgeschlagen.";
    showMessage(message, "error");
    clearResults();
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Berechne …" : "Pooling berechnen";
}

function showMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
  statusMessage.classList.remove("is-hidden");
}

function clearResults() {
  emptyState.classList.remove("is-hidden");
  summary.classList.add("is-hidden");
  resultsPanel.classList.add("is-hidden");
  summaryCards.innerHTML = "";
  poolGroups.innerHTML = "";
  resultsTableBody.innerHTML = "";
}

function renderResults(journeys) {
  emptyState.classList.add("is-hidden");
  summary.classList.remove("is-hidden");
  resultsPanel.classList.remove("is-hidden");

  renderSummary(journeys);
  renderTable(journeys);
}

function renderSummary(journeys) {
  const scheduled = journeys.filter((journey) => journey.status === "SCHEDULED").length;
  const denied = journeys.filter((journey) => journey.status === "DENIED").length;
  const waiting = journeys.filter((journey) => journey.status === "WAITING").length;
  const pools = new Map();

  for (const journey of journeys) {
    if (journey.pool_number > 0) {
      const entries = pools.get(journey.pool_number) || [];
      entries.push(journey);
      pools.set(journey.pool_number, entries);
    }
  }

  const cards = [
    ["Fahrten", journeys.length],
    ["Geplante Fahrten", scheduled],
    ["Abgelehnt", denied],
    ["Offen", waiting],
    ["Pools", pools.size],
  ];

  summaryCards.innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="taxi-summary-card">
          <p class="taxi-summary-card__label">${escapeHtml(label)}</p>
          <p class="taxi-summary-card__value">${escapeHtml(String(value))}</p>
        </article>
      `,
    )
    .join("");

  const sortedPools = [...pools.entries()].sort((left, right) => left[0] - right[0]);
  if (sortedPools.length === 0) {
    poolGroups.innerHTML = "<p>Es wurden keine Pools gebildet.</p>";
    return;
  }

  poolGroups.innerHTML = `
    <div class="taxi-pool-groups">
      ${sortedPools
        .map(([poolNumber, members]) => {
          const destinations = [...new Set(members.map((member) => member.destination_name))].join(", ");
          return `
            <section class="taxi-pool-group">
              <h3 class="taxi-pool-group__title">Pool ${escapeHtml(String(poolNumber))}</h3>
              <p><strong>Ziele:</strong> ${escapeHtml(destinations)}</p>
              <ul class="taxi-pool-group__list">
                ${members
                  .map(
                    (member) => `
                      <li>
                        ${escapeHtml(member.id)} → ${escapeHtml(member.destination_name)}
                        ${member.intermediate_stops.length ? `(über ${escapeHtml(member.intermediate_stops.join(", "))})` : ""}
                        ${typeof member.travel_distance_km === "number" ? `(${escapeHtml(formatDistance(member.travel_distance_km))})` : ""}
                      </li>
                    `,
                  )
                  .join("")}
              </ul>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTable(journeys) {
  resultsTableBody.innerHTML = journeys
    .map(
      (journey) => `
        <tr>
          <td>${escapeHtml(journey.id)}</td>
          <td>${escapeHtml(journey.destination_name)}</td>
          <td>${escapeHtml(journey.status)}</td>
          <td>${journey.deny_reason ? escapeHtml(formatDenyReason(journey.deny_reason)) : "-"}</td>
          <td>${journey.pool_number > 0 ? escapeHtml(String(journey.pool_number)) : "-"}</td>
          <td>${journey.intermediate_stops.length ? escapeHtml(journey.intermediate_stops.join(", ")) : "-"}</td>
          <td>${typeof journey.travel_distance_km === "number" ? escapeHtml(formatDistance(journey.travel_distance_km)) : "-"}</td>
        </tr>
      `,
    )
    .join("");
}

function formatDistance(distanceKm) {
  return `${distanceKm.toFixed(1)} km`;
}

function formatDenyReason(reason) {
  switch (reason) {
    case "MAX_ROUTE_DISTANCE_EXCEEDED":
      return "Maximale Zieldistanz überschritten";
    case "POOL_DISTANCE_EXCEEDED":
      return "Maximale Pool-Distanz überschritten";
    default:
      return reason;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


