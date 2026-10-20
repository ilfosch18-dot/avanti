(() => {
  const {
    showMessage,
    hideMessage,
    setLoading,
    formatDate,
    formatCm,
    formatWeight,
    formatSignedWeight,
    daysSince,
    renderWeightChart,
  } = window.NutriTrack;

  const loadingElement = document.getElementById("nutritionist-loading");
  const errorElement = document.getElementById("nutritionist-error");
  const errorTextElement = document.getElementById("nutritionist-error-text");
  const contentElement = document.getElementById("nutritionist-content");
  const retryButton = document.getElementById("nutritionist-retry");

  const patientListElement = document.getElementById("patient-list");
  const patientListEmpty = document.getElementById("patient-list-empty");
  const patientCount = document.getElementById("patient-count");
  const refreshButton = document.getElementById("refresh-patients");

  const patientEmpty = document.getElementById("patient-empty");
  const patientDetailContent = document.getElementById(
    "patient-detail-content",
  );

  const dietForm = document.getElementById("diet-form");
  const dietDateInput = document.getElementById("diet-date");
  const dietSaveButton = document.getElementById("diet-save");
  const dietMessage = document.getElementById("diet-message");

  const patientMeasurementsBody = document.getElementById(
    "patient-measurements-body",
  );
  const patientMeasurementsEmpty = document.getElementById(
    "patient-measurements-empty",
  );
  const patientMeasurementsTableWrap = document.getElementById(
    "patient-measurements-table-wrap",
  );
  const patientMeasurementsLoading = document.getElementById(
    "patient-measurements-loading",
  );
  const patientDataMessage = document.getElementById(
    "patient-data-message",
  );

  let currentUser = null;
  let patients = [];
  let allMeasurements = [];
  let selectedPatientId = null;
  let detailRequestId = 0;
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

  function goToClientDashboard() {
    if (isLeaving) {
      return;
    }

    isLeaving = true;
    window.location.replace("dashboard.html");
  }

  function selectedPatient() {
    return patients.find((patient) => patient.id === selectedPatientId) ?? null;
  }

  function latestMeasurementFor(clientId) {
    return (
      allMeasurements.find((measurement) => measurement.client_id === clientId) ??
      null
    );
  }

  function measurementsFor(clientId) {
    return allMeasurements.filter(
      (measurement) => measurement.client_id === clientId,
    );
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

  function daysLabel(patient) {
    const days = daysSince(patient?.diet_start_date);
    if (days === null || days < 0) {
      return "—";
    }

    return String(days);
  }

  function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
  }

  function renderPatientList() {
    patientListElement.replaceChildren();
    patientCount.textContent = String(patients.length);

    const hasPatients = patients.length > 0;
    patientListEmpty.hidden = hasPatients;

    if (!hasPatients) {
      patientEmpty.hidden = false;
      patientDetailContent.hidden = true;
      return;
    }

    patients.forEach((patient) => {
      const latest = latestMeasurementFor(patient.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "patient-item";
      button.dataset.patientId = patient.id;
      button.setAttribute("role", "listitem");

      if (patient.id === selectedPatientId) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "true");
      }

      const name = document.createElement("strong");
      name.className = "patient-item-name";
      name.textContent = patient.display_name;

      const email = document.createElement("span");
      email.className = "patient-item-email";
      email.textContent = patient.email || "Email non disponibile";

      const meta = document.createElement("span");
      meta.className = "patient-item-meta";
      meta.textContent = latest
        ? `Ultimo peso: ${formatWeight(latest.weight_kg)} · ${formatDate(
            latest.measured_on,
          )} · ${daysLabel(patient)} giorni`
        : `Nessuna misurazione · ${daysLabel(patient)} giorni di dieta`;

      button.append(name, email, meta);
      patientListElement.append(button);
    });
  }

  function renderPatientHeader(patient) {
    document.getElementById("patient-name").textContent = patient.display_name;
    document.getElementById("patient-email").textContent =
      patient.email || "Non disponibile";
    document.getElementById("patient-phone").textContent =
      patient.phone || "Non indicato";
    document.getElementById("patient-height").textContent = formatCm(
      patient.height_cm,
    );
    document.getElementById("patient-member-since").textContent = formatDate(
      patient.created_at,
    );
    dietDateInput.value = patient.diet_start_date || "";

    hideMessage(dietMessage);
    hideMessage(patientDataMessage);
  }

  function renderPatientSummary(measurements) {
    const ascending = sortedAscending(measurements);
    const patient = selectedPatient();

    document.getElementById("patient-summary-days").textContent = daysLabel(
      patient,
    );
    document.getElementById("patient-summary-count").textContent = String(
      measurements.length,
    );

    if (ascending.length === 0) {
      document.getElementById("patient-summary-current-weight").textContent =
        "—";
      document.getElementById("patient-summary-weight-change").textContent =
        "—";
      return;
    }

    const latest = ascending[ascending.length - 1];
    const earliest = ascending[0];

    document.getElementById("patient-summary-current-weight").textContent =
      formatWeight(latest.weight_kg);

    if (ascending.length < 2) {
      document.getElementById("patient-summary-weight-change").textContent =
        "—";
    } else {
      document.getElementById("patient-summary-weight-change").textContent =
        formatSignedWeight(
          Number(latest.weight_kg) - Number(earliest.weight_kg),
        );
    }
  }

  function renderPatientHistory(measurements) {
    patientMeasurementsBody.replaceChildren();

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
      patientMeasurementsBody.append(row);
    });

    const hasMeasurements = measurements.length > 0;
    patientMeasurementsTableWrap.hidden = !hasMeasurements;
    patientMeasurementsEmpty.hidden = hasMeasurements;

    renderWeightChart(
      document.getElementById("patient-chart"),
      sortedAscending(measurements),
    );
  }

  async function loadPatientDetail(patientId) {
    const patient = patients.find((entry) => entry.id === patientId);
    if (!patient) {
      return;
    }

    const requestId = ++detailRequestId;

    patientEmpty.hidden = true;
    patientDetailContent.hidden = false;
    renderPatientHeader(patient);
    renderPatientSummary(measurementsFor(patient.id));
    renderPatientHistory(measurementsFor(patient.id));

    patientMeasurementsLoading.hidden = false;
    hideMessage(patientDataMessage);

    try {
      const { data, error } = await supabaseClient
        .from("measurements")
        .select("*")
        .eq("client_id", patient.id)
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      if (requestId !== detailRequestId || selectedPatientId !== patient.id) {
        return;
      }

      renderPatientHistory(data ?? []);
      renderPatientSummary(data ?? []);
    } catch (error) {
      if (requestId !== detailRequestId) {
        return;
      }

      console.error("Could not load patient measurements:", error);
      showMessage(
        patientDataMessage,
        "Non siamo riusciti a caricare le misurazioni di questo paziente. Riprova.",
        "error",
      );
    } finally {
      if (requestId === detailRequestId) {
        patientMeasurementsLoading.hidden = true;
      }
    }
  }

  function selectPatient(patientId) {
    if (!patients.some((patient) => patient.id === patientId)) {
      return;
    }

    selectedPatientId = patientId;
    renderPatientList();
    loadPatientDetail(patientId);
  }

  async function loadPatients(keepSelection = true) {
    refreshButton.disabled = true;
    hideMessage(patientDataMessage);

    try {
      const [patientsResult, measurementsResult] = await Promise.all([
        supabaseClient
          .from("profiles")
          .select(
            "id, display_name, email, phone, height_cm, diet_start_date, created_at",
          )
          .eq("role", "client")
          .order("display_name", { ascending: true }),
        supabaseClient
          .from("measurements")
          .select("client_id, measured_on, weight_kg, created_at")
          .order("measured_on", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (patientsResult.error) {
        throw patientsResult.error;
      }

      if (measurementsResult.error) {
        throw measurementsResult.error;
      }

      patients = patientsResult.data ?? [];
      allMeasurements = measurementsResult.data ?? [];

      if (patients.length === 0) {
        selectedPatientId = null;
      } else if (
        !keepSelection ||
        !patients.some((patient) => patient.id === selectedPatientId)
      ) {
        selectedPatientId = patients[0].id;
      }

      renderPatientList();

      if (selectedPatientId) {
        await loadPatientDetail(selectedPatientId);
      } else {
        patientDetailContent.hidden = true;
        patientEmpty.hidden = false;
      }

      showContent();
    } catch (error) {
      console.error("Could not load patients:", error);

      if (contentElement.hidden) {
        showError(
          "Non siamo riusciti a caricare l'elenco dei pazienti. Controlla la connessione e riprova.",
        );
      } else {
        showMessage(
          patientDataMessage,
          "Non siamo riusciti ad aggiornare i dati. Riprova.",
          "error",
        );
      }
    } finally {
      refreshButton.disabled = false;
    }
  }

  function bindPatientList() {
    patientListElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-patient-id]");
      if (!button) {
        return;
      }

      selectPatient(button.dataset.patientId);
    });

    refreshButton.addEventListener("click", () => {
      loadPatients(true);
    });
  }

  function bindDietForm() {
    dietForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(dietMessage);

      if (!selectedPatientId) {
        return;
      }

      if (!dietDateInput.value) {
        showMessage(
          dietMessage,
          "Seleziona la data di inizio dieta.",
          "error",
        );
        return;
      }

      setLoading(dietSaveButton, true, "Salvataggio…");

      try {
        const { data, error } = await supabaseClient.rpc(
          "set_diet_start_date",
          {
            p_client_id: selectedPatientId,
            p_date: dietDateInput.value,
          },
        );

        if (error) {
          throw error;
        }

        const patient = selectedPatient();
        if (!patient) {
          return;
        }

        patient.diet_start_date = data || dietDateInput.value;

        renderPatientList();
        renderPatientHeader(patient);
        renderPatientSummary(measurementsFor(patient.id));
        showMessage(
          dietMessage,
          "Data di inizio dieta aggiornata.",
          "success",
        );
      } catch (error) {
        console.error("Could not set diet start date:", error);
        showMessage(
          dietMessage,
          "Non siamo riusciti a salvare la data. Verifica i permessi e riprova.",
          "error",
        );
      } finally {
        setLoading(dietSaveButton, false);
      }
    });
  }

  async function initPage() {
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
            "Non siamo riusciti a confermare il link di accesso. Potrebbe essere scaduto. Accedi di nuovo.",
          );
          return;
        }

        goToLogin();
        return;
      }

      currentUser = session.user;

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (isLeaving) {
        return;
      }

      if (profileError) {
        console.error("Could not load the professional profile:", profileError);
        showError(
          "Non siamo riusciti a verificare il tuo ruolo. Controlla la connessione e riprova.",
        );
        return;
      }

      if (!profile) {
        showError(
          "Non è stato trovato un profilo per questo account. Assicurati di aver eseguito db.sql in Supabase.",
        );
        return;
      }

      if (profile.role !== "nutritionist") {
        goToClientDashboard();
        return;
      }

      await loadPatients(false);
    } catch (error) {
      console.error("Professional area loading failed:", error);
      showError(
        "Non siamo riusciti a caricare l'area professionale. Controlla la connessione e riprova.",
      );
    }
  }

  if (!supabaseClient) {
    showError(
      "L'area professionale richiede Supabase. Aggiungi l'URL del progetto e la publishable key in js/config.js, poi ricarica la pagina.",
    );
    return;
  }

  retryButton.addEventListener("click", initPage);
  bindPatientList();
  bindDietForm();

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && !window.NutriTrack.isLoggingOut) {
      goToLogin(true);
    }
  });

  initPage();
})();
