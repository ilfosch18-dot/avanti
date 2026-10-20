(() => {
  const { getSafeNextPath, showMessage, hideMessage, setLoading } =
    window.NutriTrack;

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const authErrorMessages = [
    [
      "Invalid login credentials",
      "Email o password non corretti. Controlla i dati e riprova.",
    ],
    [
      "Email not confirmed",
      "Devi ancora confermare la tua email. Controlla la posta e apri il link di conferma.",
    ],
    [
      "Too many requests",
      "Troppi tentativi. Attendi qualche istante e riprova.",
    ],
    [
      "Email rate limit exceeded",
      "Sono state richieste troppe email. Attendi prima di riprovare.",
    ],
    [
      "User already registered",
      "Esiste già un account con questa email. Prova ad accedere.",
    ],
    [
      "Password should be at least",
      "La password è troppo corta. Usa almeno 8 caratteri.",
    ],
    [
      "Unable to validate email address",
      "Inserisci un indirizzo email valido.",
    ],
    [
      "Signups not allowed",
      "Le nuove registrazioni sono momentaneamente disabilitate.",
    ],
    [
      "Failed to fetch",
      "Connessione non disponibile. Controlla la rete e riprova.",
    ],
  ];

  function friendlyAuthError(error) {
    const message = error?.message || "Si è verificato un errore.";

    const match = authErrorMessages.find(([fragment]) =>
      message.toLowerCase().includes(fragment.toLowerCase()),
    );

    return match
      ? match[1]
      : `Non siamo riusciti a completare la richiesta: ${message}`;
  }

  function disableForms() {
    document.querySelectorAll("form").forEach((form) => {
      form.querySelectorAll("button, input, textarea").forEach((element) => {
        element.disabled = true;
      });
    });
  }

  async function redirectIfSignedIn() {
    if (!supabaseClient) {
      return;
    }

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (session) {
        window.location.replace(getSafeNextPath());
      }
    } catch (error) {
      console.error("Could not check the current session:", error);
    }
  }

  function initLoginForm() {
    const form = document.getElementById("login-form");
    if (!form) {
      return;
    }

    const messageElement = document.getElementById("form-message");
    const submitButton = document.getElementById("login-submit");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(messageElement);

      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;

      if (!emailPattern.test(email)) {
        showMessage(messageElement, "Inserisci un indirizzo email valido.", "error");
        form.elements.email.focus();
        return;
      }

      if (!password) {
        showMessage(messageElement, "Inserisci la tua password.", "error");
        form.elements.password.focus();
        return;
      }

      setLoading(submitButton, true, "Accesso in corso…");

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        window.location.replace(getSafeNextPath());
      } catch (error) {
        console.error("Login failed:", error);
        showMessage(messageElement, friendlyAuthError(error), "error");
        setLoading(submitButton, false);
      }
    });
  }

  function initRegisterForm() {
    const form = document.getElementById("register-form");
    if (!form) {
      return;
    }

    const messageElement = document.getElementById("form-message");
    const submitButton = document.getElementById("register-submit");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideMessage(messageElement);

      const displayName = form.elements.displayName.value.trim();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const confirmPassword = form.elements.confirmPassword.value;

      if (displayName.length < 2 || displayName.length > 60) {
        showMessage(
          messageElement,
          "Il nome visualizzato deve contenere tra 2 e 60 caratteri.",
          "error",
        );
        form.elements.displayName.focus();
        return;
      }

      if (!emailPattern.test(email)) {
        showMessage(messageElement, "Inserisci un indirizzo email valido.", "error");
        form.elements.email.focus();
        return;
      }

      if (password.length < 8) {
        showMessage(
          messageElement,
          "La password deve contenere almeno 8 caratteri.",
          "error",
        );
        form.elements.password.focus();
        return;
      }

      if (password !== confirmPassword) {
        showMessage(messageElement, "Le due password non coincidono.", "error");
        form.elements.confirmPassword.focus();
        return;
      }

      const emailRedirectTo = new URL(
        "dashboard.html",
        window.location.href,
      ).toString();

      setLoading(submitButton, true, "Creazione account…");

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo,
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          window.location.replace("dashboard.html");
          return;
        }

        form.reset();
        setLoading(submitButton, false);
        showMessage(
          messageElement,
          `Controlla la casella ${email}. Apri il link di conferma per attivare l'account, poi accedi.`,
          "success",
        );
      } catch (error) {
        console.error("Registration failed:", error);
        showMessage(messageElement, friendlyAuthError(error), "error");
        setLoading(submitButton, false);
      }
    });
  }

  if (!supabaseClient) {
    disableForms();
    showMessage(
      document.getElementById("form-message"),
      "L'autenticazione non è disponibile perché Supabase non è configurato. Aggiungi l'URL del progetto e la publishable key in js/config.js.",
      "error",
    );
    return;
  }

  initLoginForm();
  initRegisterForm();
  redirectIfSignedIn();
})();
