const translations = {
  pl: {
    scanPrompt: "Fotografuj i eksploruj z Antiq",
    aboutTitle: "O przedmiocie",
    priceTitle: "Szacowana cena rynkowa",
    historyTitle: "Historia i analiza stylu",
    analyzing: "Analizowanie antyku przez Antiq AI...",
  },
  en: {
    scanPrompt: "Capture & Explore with Antiq",
    aboutTitle: "About Item",
    priceTitle: "Estimated Market Value",
    historyTitle: "History & Style Analysis",
    analyzing: "Analyzing antique via Antiq AI...",
  },
};

let currentLang =
  localStorage.getItem("app_lang") ||
  (navigator.language.startsWith("pl") ? "pl" : "en");

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("lang-select").value = currentLang;
  applyLanguageTexts();
});

function changeLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("app_lang", lang);
  applyLanguageTexts();
}

function applyLanguageTexts() {
  const t = translations[currentLang];
  document.getElementById("ui-scan-prompt").innerText = t.scanPrompt;
  document.getElementById("ui-title-label").innerText = t.aboutTitle;
  document.getElementById("ui-price-label").innerText = t.priceTitle;
  document.getElementById("ui-history-label").innerText = t.historyTitle;
}

// Zmniejsza zdjęcie (maks. 1500 px po dłuższym boku) i zamienia na JPEG.
function resizeImage(dataUrl, maxSize = 1500) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Nie udało się wczytać zdjęcia."));
    img.src = dataUrl;
  });
}

// Główna funkcja obsługi wyboru/zrobienia zdjęcia
async function handleImageSelection(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const t = translations[currentLang];
    document.getElementById("results-section").style.display = "block";
    document.getElementById("res-name").innerText = t.analyzing;
    document.getElementById("res-price").innerText = "⏳ ...";
    document.getElementById("res-history").innerText = "⏳ ...";

    try {
      const base64Image = await resizeImage(e.target.result);
      document.getElementById("image-preview").src = base64Image;

      const result = await analyzeImageWithAI(base64Image);

      document.getElementById("res-name").innerText =
        result.nazwa || "Przedmiot antyczny";
      document.getElementById("res-price").innerText =
        result.cena || "Do wyceny indywidualnej";
      document.getElementById("res-history").innerText =
        result.historia || "Brak opisu historii.";
    } catch (error) {
      console.error("Błąd podczas analizy:", error);
      document.getElementById("res-name").innerText =
        "Błąd analizy rzeczoznawcy";
      document.getElementById("res-price").innerText = "—";
      document.getElementById("res-history").innerText =
        "Szczegóły błędu: " + error.message;
    }
  };
  reader.readAsDataURL(file);

  event.target.value = "";
}

// Komunikacja bezpośrednia z API Anthropic z poziomu przeglądarki
async function analyzeImageWithAI(base64Image) {
  // ==========================================
  // TUTAJ WKLEJ SWÓJ PEŁNY KLUCZ API W CUDZYŁOWIE:
  // ==========================================
  const ANTHROPIC_API_KEY = "sk-ant-...";

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.startsWith("sk-ant-...")) {
    throw new Error("Brak poprawnego klucza API w pliku app.js!");
  }

  const mimeType = base64Image.split(";")[0].split(":")[1];
  const base64Data = base64Image.split(",")[1];

  const languagePrompt =
    currentLang === "pl" ? "Odpowiedz w języku polskim." : "Answer in English.";

  const systemPrompt = `Jesteś wybitnym rzeczoznawcą i ekspertem ds. antyków, dzieł sztuki oraz osobliwości. 
Twoje analizy są niezwykle precyzyjne, eleganckie i dostojne.
${languagePrompt}

Zwróć odpowiedź WYŁĄCZNIE w czystym formacie JSON (bez bloków kodowych typu \`\`\`json):
{
  "nazwa": "Precyzyjna nazwa przedmiotu, jego styl, epoka oraz przewidywane pochodzenie",
  "cena": "Szacowana wartość rynkowa (np. 250 - 450 PLN lub £50 - £90)",
  "historia": "Ekspercka analiza rzeczoznawcy: materiał, technika wykonania, cechy stylu, patyna, ocena rzadkości i unikalne detale."
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: "Dokonaj eksperckiej ekspertyzy i wyceny tego antyku.",
            },
          ],
        },
      ],
    }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(
      responseData.error?.message ||
        responseData.message ||
        `Błąd API HTTP ${response.status}`,
    );
  }

  let textResponse = "";
  if (responseData.content && Array.isArray(responseData.content)) {
    const textBlock = responseData.content.find(
      (block) => block.type === "text",
    );
    if (textBlock && textBlock.text) {
      textResponse = textBlock.text;
    }
  }

  if (!textResponse) {
    throw new Error("API nie zwróciło odpowiedzi tekstowej.");
  }

  let cleanedText = textResponse
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const start = cleanedText.indexOf("{");
  const end = cleanedText.lastIndexOf("}");

  if (start === -1 || end === -1) {
    throw new Error(
      "Odpowiedź nie zawiera poprawnego JSON-a. Surowy tekst: " + textResponse,
    );
  }

  const jsonString = cleanedText.slice(start, end + 1);

  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    console.warn("Uruchamiam parsowanie awaryjne...");

    try {
      const nazwaMatch = jsonString.match(/"nazwa"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const cenaMatch = jsonString.match(/"cena"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const historiaMatch = jsonString.match(
        /"historia"\s*:\s*"((?:[^"\\]|\\.)*)"/,
      );

      if (nazwaMatch && cenaMatch && historiaMatch) {
        return {
          nazwa: nazwaMatch[1].replace(/\\"/g, '"'),
          cena: cenaMatch[1].replace(/\\"/g, '"'),
          historia: historiaMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
        };
      }
    } catch (e) {}

    throw new Error("Błąd parsowania JSON-a: " + parseError.message);
  }
}