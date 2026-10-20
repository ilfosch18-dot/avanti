(() => {
  const {
    getDisplayName,
    showMessage,
    hideMessage,
    setLoading,
    formatDate,
    formatCm,
    formatWeight,
    formatSignedWeight,
    todayInputValue,
    daysSince,
    parseOptionalNumber,
    renderWeightChart,
  } = window.NutriTrack;

  const loadingElement = document.getElementById("dashboard-loading");
  const errorElement = document.getElementById("dashboard-error");
  const errorTextElement = document.getElementById("dashboard-error-text");
  const contentElement = document.getElementById("dashboard-content");
  const retryButton = document.getElementById("dashboard-retry");

  const profileForm = document.getElementById("profile-form");
  const profileMessage = document.getElementById("profile-message");
  const profileSaveButton = document.getElementById("profile-save");

  const measurementForm = document.getElementById("measurement-form");
  const measurementMessage = document.getElementById("measurement-message");
  const measurementSubmit = document.getElementById("measurement-submit");
  const measuredOnInput = document.getElementById("measured-on");

  const measurementsBody = document.getElementById("measurements-body");
  const measurementsEmpty = document.getElementById("measurements-empty");
  const measurementsTableWrap = document.getElementById(
    "measurements-table-wrap",
  );
  const measurementsLoading = document.getElementById("measurements-loading");
  const measurementsMessage = document.getElementById("measurements-message");

  let currentUser = null;
  let currentProfile = null;
  let measurements = [];
  let isLeaving = false;

  function showLoading() {
    loadingElement.hidden = false;
    errorElement.hidden = true;
    contentElement.hidden = true;
  }

  function showError(message) {
    loadingElement.hidden = true;
    contentElement.hidden = true;
    errorTextElement.textContent = message;
    errorElement.hidden = false;
  }

  function showContent() {
    loadingElement.hidden = true;
    errorElement.hidden = true;
    contentElement.hidden = false;
  }

  function goToLogin(sessionExpired = false) {
    if (isLeaving) {
      return;
    }

    isLeaving = true;

    const loginUrl = new URL("login.html", window.location.href);
    loginUrl.searchParams.set("next", "dashboard.html");

    if (sessionExpired) {
      loginUrl.searchParams.set("session_expired", "1");
    }

    window.location.replace(loginUrl.toString());
  }

  function goToNutritionistPage() {
    if (isLeaving) {
      return;
    }

    isLeaving = true;
    window.location.replace("nutritionist.html");
  }

  function sortedAscending(entries) {
    return [...entries].sort((a, b) => {
      const dateCompare = String(a.measured_on).localeCompare(
        String(b.measured_on),
      );
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(a.created_at ?? "").localeCompare(
        String(b.created_at ?? ""),
      );
    });
  }

  function daysLabel(profile) {
    const days = daysSince(profile?.diet_start_date);
    if (days === null || days < 0) {
      return "—";
    }

    return String(days);
  }

  function renderProfile(profile, user) {
    const displayName = profile.display_name || getDisplayName(user);

    document.getElementById("welcome-heading").textContent =
      `Ciao, ${displayName}`;
    document.getElementById("welcome-subtitle").textContent =
      "Qui trovi le tue misure e l'andamento del percorso nel tempo.";
    document.getElementById("role-badge").textContent = "Paziente";

    document.getElementById("profile-name").value = displayName;
    document.getElementById("profile-email").value =
      profile.email || user.email || "";
    document.getElementById("profile-phone").value = profile.phone || "";
    document.getElementById("profile-height").value =
      profile.height_cm ?? "";
    document.getElementById("diet-start-date").value = profile.diet_start_date
      ? formatDate(profile.diet_start_date)
      : "Non impostata";
  }

  function renderSummary() {
    const ascending = sortedAscending(measurements);
    const latest = ascending[ascending.length - 1];
    const earliest = ascending[0];

    document.getElementById("summary-days").textContent = daysLabel(
      currentProfile,
    );
    document.getElementById("summary-current-weight").textContent =
      latest ? formatWeight(latest.weight_kg) : "—";
    document.getElementById("summary-count").textContent = String(
      measurements.length,
    );

    if (ascending.length < 2) {
      document.getElementById("summary-weight-change").textContent = "—";
    } else {
      const difference =
        Number(latest.weight_kg) - Number(earliest.weight_kg);
      document.getElementById("summary-weight-change").textContent =
        formatSignedWeight(difference);
    }
  }

  function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function renderHistory() {
    measurementsBody.replaceChildren();

    measurements.forEach((measurement) => {
      const row = document.createElement("tr");

      row.append(
        createCell(formatDate(measurement.measured_on)),
        createCell(formatWeight(measurement.weight_kg)),
        createCell(formatCm(measurement.waist_cm)),
        createCell(formatCm(measurement.hips_cm)),
        createCell(formatCm(measurement.chest_cm)),
        createCell(formatCm(measurement.arm_cm)),
        createCell(formatCm(measurement.thigh_cm)),
        createCell(formatCm(measurement.neck_cm)),
        createCell(measurement.notes ? measurement.notes : "—"),
      );

      const actionsCell = document.createElement("td");
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn btn-danger btn-small";
      deleteButton.dataset.deleteMeasurement = measurement.id;
      deleteButton.textContent = "Elimina";
      deleteButton.setAttribute(
        "aria-label",
        `Elimina la misurazione del ${formatDate(measurement.measured_on)}`,
      );
      actionsCell.append(deleteButton);
      row.append(actionsCell);

      measurementsBody.append(row);
    });

    const hasMeasurements = measurements.length > 0;
    measurementsTableWrap.hidden = !hasMeasurements;
    measurementsEmpty.hidden = hasMeasurements;

    renderWeightChart(
      document.getElementById("weight-chart"),
      sortedAscending(measurements),
    );
  }

  async function loadMeasurements(clientId) {
    measurementsLoading.hidden = false;
    hideMessage(measurementsMessage);

    try {
      const { data, error } = await supabaseClient
        .from("measurements")
        .select("*")
        .eq("client_id", clientId)
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      measurements = data ?? [];
      renderHistory();
      renderSummary();
    } catch (error) {
      console.error("Could not load measurements:", error);
      showMessage(
        measurementsMessage,
        "Non siamo riusciti a caricare lo storico delle misurazioni. Riprova più tardi.",
        "error",
      );
    } finally {
      measurementsLoading.hidden = true;
    }
  }

  function measurementPayload() {
    const payload = {
      client_id: currentUser.id,
      measured_on: measuredOnInput.value,
      weight_kg: Number(measurementForm.elements.weight.value),
      waist_cm: parseOptionalNumber(measurementForm.elements.waist),
      hips_cm: parseOptionalNumber(measurementForm.elements.hips),
      chest_cm: parseOptionalNumber(measurementForm.elements.chest),
      arm_cm: parseOptionalNumber(measurementForm.elements.arm),
      thigh_cm: parseOptionalNumber(measurementForm.elements.thigh),
      neck_cm: parseOptionalNumber(measurementForm.elements.neck),
      notes: measurementForm.elements.notes.value.trim() || null,
    };

    return payload;
  }

  function bindProfileForm() {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(profileMessage);

      const phone = document.getElementById("profile-phone").value.trim();
      const heightValue = document
        .getElementById("profile-height")
        .value.trim();
      const height = heightValue ? Number(heightValue) : null;

      if (phone.length > 30) {
        showMessage(
          profileMessage,
          "Il numero di telefono non può superare 30 caratteri.",
          "error",
        );
        return;
      }

      if (height !== null && (!Number.isFinite(height) || height < 50 || height > 250)) {
        showMessage(
          profileMessage,
          "Inserisci un'altezza valida tra 50 e 250 cm.",
          "error",
        );
        return;
      }

      setLoading(profileSaveButton, true, "Salvataggio…");

      try {
        const { error } = await supabaseClient
          .from("profiles")
          .update({
            phone: phone || null,
            height_cm: height,
          })
          .eq("id", currentUser.id);

        if (error) {
          throw error;
        }

        currentProfile.phone = phone || null;
        currentProfile.height_cm = height;

        showMessage(profileMessage, "Dati aggiornati correttamente.", "success");
      } catch (error) {
        console.error("Could not update profile:", error);
        showMessage(
          profileMessage,
          "Non siamo riusciti a salvare i dati. Controlla i valori e riprova.",
          "error",
        );
      } finally {
        setLoading(profileSaveButton, false);
      }
    });
  }

  function bindMeasurementForm() {
    measurementForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(measurementMessage);

      if (!measurementForm.checkValidity()) {
        measurementForm.reportValidity();
        return;
      }

      const payload = measurementPayload();

      if (!payload.measured_on) {
        showMessage(
          measurementMessage,
          "Seleziona la data della misurazione.",
          "error",
        );
        return;
      }

      if (
        !Number.isFinite(payload.weight_kg) ||
        payload.weight_kg < 20 ||
        payload.weight_kg > 400
      ) {
        showMessage(
          measurementMessage,
          "Inserisci un peso valido tra 20 e 400 kg.",
          "error",
        );
        return;
      }

      setLoading(measurementSubmit, true, "Salvataggio…");

      try {
        const { error } = await supabaseClient
          .from("measurements")
          .insert(payload);

        if (error) {
          throw error;
        }

        measurementForm.reset();
        measuredOnInput.value = todayInputValue();

        await loadMeasurements(currentUser.id);
        showMessage(
          measurementMessage,
          "Misurazione salvata. Il tuo storico e il grafico sono aggiornati.",
          "success",
        );
      } catch (error) {
        console.error("Could not save measurement:", error);
        showMessage(
          measurementMessage,
          "Non siamo riusciti a salvare la misurazione. Controlla i valori e riprova.",
          "error",
        );
      } finally {
        setLoading(measurementSubmit, false);
      }
    });
  }

  function bindMeasurementActions() {
    measurementsBody.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-delete-measurement]");
      if (!button) {
        return;
      }

      const confirmed = window.confirm(
        "Vuoi eliminare questa misurazione? L'operazione non può essere annullata.",
      );

      if (!confirmed) {
        return;
      }

      button.disabled = true;
      hideMessage(measurementsMessage);

      try {
        const { error } = await supabaseClient
          .from("measurements")
          .delete()
          .eq("id", button.dataset.deleteMeasurement)
          .eq("client_id", currentUser.id);

        if (error) {
          throw error;
        }

        await loadMeasurements(currentUser.id);
        showMessage(measurementsMessage, "Misurazione eliminata.", "success");
      } catch (error) {
        console.error("Could not delete measurement:", error);
        button.disabled = false;
        showMessage(
          measurementsMessage,
          "Non siamo riusciti a eliminare la misurazione. Riprova.",
          "error",
        );
      }
    });
  }

  async function loadDashboard() {
    showLoading();

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabaseClient.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        if (window.NutriTrack.authLinkError) {
          showError(
            "Non siamo riusciti a confermare il link di accesso. Potrebbe essere scaduto. Accedi di nuovo o registra un nuovo account.",
          );
          return;
        }

        goToLogin();
        return;
      }

      currentUser = session.user;

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select(
          "display_name, role, email, phone, height_cm, diet_start_date, created_at",
        )
        .eq("id", currentUser.id)
        .maybeSingle();

      if (isLeaving) {
        return;
      }

      if (profileError) {
        console.error("Could not load the profile:", profileError);
        showError(
          "Non siamo riusciti a caricare il tuo profilo. Controlla la connessione e riprova.",
        );
        return;
      }

      if (!profile) {
        showError(
          "Non è stato trovato un profilo per questo account. Se hai appena configurato il progetto, assicurati di aver eseguito db.sql in Supabase.",
        );
        return;
      }

      if (profile.role === "nutritionist") {
        goToNutritionistPage();
        return;
      }

      currentProfile = profile;
      renderProfile(profile, currentUser);

      await loadMeasurements(currentUser.id);
      renderSummary();
      showContent();
    } catch (error) {
      console.error("Dashboard loading failed:", error);
      showError(
        "Non siamo riusciti a caricare la dashboard. Controlla la connessione e riprova.",
      );
    }
  }

  if (!supabaseClient) {
    showError(
      "La dashboard richiede Supabase. Aggiungi l'URL del progetto e la publishable key in js/config.js, poi ricarica la pagina.",
    );
    return;
  }

  measuredOnInput.value = todayInputValue();

  retryButton.addEventListener("click", loadDashboard);
  bindProfileForm();
  bindMeasurementForm();
  bindMeasurementActions();

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && !window.NutriTrack.isLoggingOut) {
      goToLogin(true);
    }
  });

  loadDashboard();
})();
