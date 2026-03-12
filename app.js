(function () {
  const data = window.BOOK_DATA;

  if (!data || !Array.isArray(data.books)) {
    document.getElementById("question-title").textContent =
      "De boekdata kon niet worden geladen.";
    return;
  }

  const state = {
    answers: {},
    history: [],
  };

  const questionTitle = document.getElementById("question-title");
  const questionCopy = document.getElementById("question-copy");
  const optionsEl = document.getElementById("options");
  const progressEl = document.getElementById("progress");
  const resultsEl = document.getElementById("results");
  const resultsCopy = document.getElementById("results-copy");
  const selectionPillsEl = document.getElementById("selection-pills");
  const bookCountBadge = document.getElementById("book-count-badge");
  const catalogEl = document.getElementById("catalog");
  const catalogSummaryEl = document.getElementById("catalog-summary");
  const backButton = document.getElementById("back-button");
  const resetButton = document.getElementById("reset-button");

  const categoryOptions = [
    {
      id: "spannend",
      label: "Spannend en vol actie",
      description: "Voor lezers die graag mysterie, gevaar of overleven willen.",
    },
    {
      id: "fantasie",
      label: "Fantasie en magie",
      description: "Voor wie graag bijzondere werelden en vreemde krachten ontdekt.",
    },
    {
      id: "liefde",
      label: "Liefde en opgroeien",
      description: "Voor verhalen over gevoelens, familie, vriendschap en jezelf vinden.",
    },
    {
      id: "maatschappij",
      label: "Maatschappij en echte thema's",
      description: "Voor boeken over de echte wereld, dilemma's en actuele onderwerpen.",
    },
    {
      id: "verleden",
      label: "Geschiedenis en oorlog",
      description: "Voor lezers die iets uit het verleden willen meemaken of begrijpen.",
    },
    {
      id: "grappig",
      label: "Humor en iets eigens",
      description: "Voor luchtigere, aparte of speelse verhalen.",
    },
    {
      id: "echt",
      label: "Echt en realistisch",
      description: "Voor gewone levens, herkenbare situaties en mensgerichte verhalen.",
    },
  ];

  const lengthOptions = [
    { id: "kort", label: "Kort", description: "Tot ongeveer 180 pagina's." },
    { id: "middel", label: "Gemiddeld", description: "Ongeveer 180 tot 320 pagina's." },
    { id: "lang", label: "Lang", description: "Meer dan ongeveer 320 pagina's." },
  ];

  const levelOptions = [
    {
      id: "toegankelijk",
      label: "Lekker toegankelijk",
      description: "Fijn als je vlot door het verhaal wilt kunnen gaan.",
    },
    {
      id: "uitdagend",
      label: "Best uitdagend",
      description: "Iets meer verdieping, maar nog steeds goed te volgen.",
    },
    {
      id: "verdiepend",
      label: "Echt verdiepend",
      description: "Voor lezers die best een stapje verder willen gaan.",
    },
  ];

  function countMatches(questionId, optionId) {
    return applyFilters({ ...state.answers, [questionId]: optionId }).length;
  }

  function getSubjectOptions() {
    const filtered = applyFilters(state.answers);
    const counts = new Map();

    filtered.forEach((book) => {
      book.subjects.forEach((subject) => {
        counts.set(subject, (counts.get(subject) || 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))
      .slice(0, 8)
      .map(([subject, count]) => ({
        id: subject,
        label: subject,
        description: `${count} boeken passen hierbij.`,
      }));
  }

  function getQuestions() {
    return [
      {
        id: "category",
        title: "Waar heb je vooral zin in?",
        copy: "Kies eerst een richting. Daarmee maken we de lijst meteen een stuk slimmer.",
        options: categoryOptions,
      },
      {
        id: "length",
        title: "Hoe dik mag het boek ongeveer zijn?",
        copy: "Sommige leerlingen willen graag snel in een verhaal zitten, anderen juist langer lezen.",
        options: lengthOptions,
      },
      {
        id: "level",
        title: "Hoe uitdagend mag het lezen zijn?",
        copy: "Dit is gebaseerd op de niveaus van Lezen voor de lijst.",
        options: levelOptions,
      },
      {
        id: "subject",
        title: "Welk onderwerp trekt je nu het meest?",
        copy: "Deze laatste stap wordt aangepast aan de boeken die nog over zijn.",
        options: getSubjectOptions(),
      },
    ];
  }

  function applyFilters(answers) {
    return data.books.filter((book) => {
      if (
        answers.category &&
        !book.categories.some((category) => category.id === answers.category)
      ) {
        return false;
      }

      if (answers.length && book.lengthBucket.id !== answers.length) {
        return false;
      }

      if (answers.level && book.levelBucket.id !== answers.level) {
        return false;
      }

      if (answers.subject && !book.subjects.includes(answers.subject)) {
        return false;
      }

      return true;
    });
  }

  function scoreBook(book, answers) {
    let score = 0;

    if (answers.category && book.categories.some((category) => category.id === answers.category)) {
      score += 4;
    }

    if (answers.length && book.lengthBucket.id === answers.length) {
      score += 2;
    }

    if (answers.level && book.levelBucket.id === answers.level) {
      score += 2;
    }

    if (answers.subject && book.subjects.includes(answers.subject)) {
      score += 5;
    }

    score += Math.max(0, 4 - Math.abs((book.pageCount || 240) - 240) / 100);
    return score;
  }

  function getRecommendations() {
    const filtered = applyFilters(state.answers);
    return [...filtered]
      .sort((a, b) => scoreBook(b, state.answers) - scoreBook(a, state.answers))
      .slice(0, 5);
  }

  function renderProgress(questions, currentIndex) {
    progressEl.innerHTML = questions
      .map((question, index) => {
        const className =
          index < currentIndex
            ? "progress-step done"
            : index === currentIndex
              ? "progress-step active"
              : "progress-step";
        return `<div class="${className}">${index + 1}. ${question.title}</div>`;
      })
      .join("");
  }

  function renderChoices(question, questionIndex, questions) {
    questionTitle.textContent = question.title;
    questionCopy.textContent = question.copy;
    renderProgress(questions, questionIndex);

    const cards = question.options.map((option) => {
      const count = countMatches(question.id, option.id);
      const disabled = count === 0 ? "disabled" : "";
      const countLabel = count === 1 ? "1 boek" : `${count} boeken`;
      return `
        <button class="choice-card" type="button" data-question="${question.id}" data-value="${option.id}" ${disabled}>
          <strong>${option.label}</strong>
          <span>${option.description}</span>
          <span>${countLabel}</span>
        </button>
      `;
    });

    optionsEl.innerHTML = cards.join("");
  }

  function renderSelectionPills() {
    const labels = [];
    const questions = getQuestions();

    questions.forEach((question) => {
      const value = state.answers[question.id];
      if (!value) return;

      const option = question.options.find((entry) => entry.id === value);
      if (option) {
        labels.push(`<span class="pill">${option.label}</span>`);
      }
    });

    selectionPillsEl.innerHTML = labels.join("");
  }

  function renderResults() {
    const filtered = applyFilters(state.answers);
    const recommendations = getRecommendations();

    resultsCopy.textContent =
      filtered.length === 0
        ? "Met deze combinatie blijft er niets over. Ga een stap terug of begin opnieuw."
        : `Er passen ${filtered.length} boeken bij jouw keuzes. Hieronder staan de beste matches.`;

    if (!recommendations.length) {
      resultsEl.innerHTML =
        '<div class="empty-state">Nog geen boekentips. Maak links een paar keuzes of probeer een andere combinatie.</div>';
      return;
    }

    resultsEl.innerHTML = recommendations
      .map(
        (book) => `
          <article class="book-card">
            <img src="${book.cover}" alt="Omslag van ${book.title}" loading="lazy" />
            <div>
              <h3>${book.title}</h3>
              <p><strong>${book.author}</strong></p>
              <div class="meta-row">
                <span class="tag">${book.level || "Niveau onbekend"}</span>
                <span class="tag alt">${book.pageCount ? `${book.pageCount} pagina's` : "Aantal pagina's onbekend"}</span>
                <span class="tag cool">${book.genre || "Genre onbekend"}</span>
              </div>
              <p>${book.description || book.teaser || "Geen beschrijving beschikbaar."}</p>
              <div class="meta-row">
                ${book.subjects.slice(0, 4).map((subject) => `<span class="pill">${subject}</span>`).join("")}
              </div>
              <a href="${book.detailUrl}" target="_blank" rel="noreferrer">Bekijk op Jeugdbibliotheek</a>
            </div>
          </article>
        `,
      )
      .join("");
  }

  function renderCatalog() {
    bookCountBadge.textContent = `${data.total} boeken geladen`;
    catalogSummaryEl.textContent = `Bron: Jeugdbibliotheek, pagina "Alle boeken" voor 12-15 jaar. Laatst gegenereerd op ${new Date(
      data.generatedAt,
    ).toLocaleDateString("nl-NL")}.`;

    catalogEl.innerHTML = data.books
      .map(
        (book) => `
          <article class="catalog-card">
            <h3>${book.title}</h3>
            <p><strong>${book.author}</strong></p>
            <p>${book.level || "Niveau onbekend"} • ${book.pageCount || "?"} pagina's</p>
            <p>${book.genre || "Genre onbekend"}</p>
          </article>
        `,
      )
      .join("");
  }

  function currentQuestionIndex() {
    return Object.keys(state.answers).length;
  }

  function render() {
    const questions = getQuestions();
    const nextIndex = Math.min(currentQuestionIndex(), questions.length - 1);
    const question = questions[nextIndex];

    renderSelectionPills();
    renderResults();

    if (!question || currentQuestionIndex() >= questions.length) {
      questionTitle.textContent = "Je keuzes zijn compleet";
      questionCopy.textContent =
        "Hiernaast zie je de beste boekentips. Je kunt teruggaan of opnieuw beginnen.";
      renderProgress(questions, questions.length - 1);
      optionsEl.innerHTML =
        '<div class="empty-state">De beslisboom is doorlopen. Pas gerust iets aan als je een andere uitkomst wilt.</div>';
    } else {
      renderChoices(question, nextIndex, questions);
    }

    backButton.disabled = state.history.length === 0;
  }

  optionsEl.addEventListener("click", (event) => {
    const button = event.target.closest(".choice-card");
    if (!button || button.disabled) return;

    const questionId = button.dataset.question;
    const value = button.dataset.value;
    state.history.push({ ...state.answers });
    state.answers[questionId] = value;
    render();
  });

  backButton.addEventListener("click", () => {
    const previous = state.history.pop();
    state.answers = previous || {};
    render();
  });

  resetButton.addEventListener("click", () => {
    state.answers = {};
    state.history = [];
    render();
  });

  renderCatalog();
  render();
})();

