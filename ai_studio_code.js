import { GoogleGenAI, Type } from "@google/genai";

const imageInput = document.getElementById("imageInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const spinner = document.getElementById("spinner");
const statusEl = document.getElementById("status");
const reasoningEl = document.getElementById("reasoning");
const itemsEl = document.getElementById("items");
const totalEl = document.getElementById("total");
const ambiguitiesEl = document.getElementById("ambiguities");
const apiKeyInput = document.getElementById("apiKey");

const MODEL_ID = "gemini-3-flash-preview";

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reasoning: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          price: { type: Type.NUMBER },
        },
        required: ["name", "price"],
      },
    },
    totalCalculated: { type: Type.NUMBER },
    ambiguities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["reasoning", "items", "totalCalculated", "ambiguities"],
};

const prompt = [
  "You are analyzing a shopping cart screenshot (like SHEIN).",
  "Identify Products: Find every unique item name.",
  "Price Selection: Pick the current final price. Ignore strikethrough (old) prices. If two prices are visible, pick the lower one.",
  "Clutter Filtering: Explicitly ignore status bar numbers (time, battery %, signal) and notification badge counts.",
  "Reasoning: Explain why you chose certain numbers and ignored others.",
  "Return JSON that matches the provided schema.",
].join("\n");

const getApiKey = () => apiKeyInput?.value?.trim() || "";

const createClient = (apiKey) => new GoogleGenAI({ apiKey });

const setStatus = (message, isError = false) => {
  statusEl.textContent = message || "";
  statusEl.className = isError ? "error" : "muted";
};

const setLoading = (isLoading) => {
  spinner.classList.toggle("active", isLoading);
  analyzeBtn.disabled = isLoading;
  imageInput.disabled = isLoading;
};

const resetResults = () => {
  reasoningEl.textContent = "—";
  itemsEl.textContent = "—";
  totalEl.textContent = "—";
  ambiguitiesEl.textContent = "";
};

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read the image file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected image data."));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Unable to parse image data."));
        return;
      }
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });

const renderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    itemsEl.innerHTML = "<div class='muted'>No items detected. The image may be too blurry.</div>";
    return;
  }
  const list = document.createElement("ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    const name = item?.name || "Unnamed item";
    const price = Number(item?.price);
    const priceText = Number.isFinite(price) ? price.toFixed(2) : "—";
    li.textContent = `${name} — ${priceText}`;
    list.appendChild(li);
  });
  itemsEl.innerHTML = "";
  itemsEl.appendChild(list);
};

const renderAmbiguities = (ambiguities) => {
  if (!Array.isArray(ambiguities) || ambiguities.length === 0) {
    ambiguitiesEl.textContent = "";
    return;
  }
  const list = document.createElement("ul");
  ambiguities.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = entry;
    list.appendChild(li);
  });
  ambiguitiesEl.innerHTML = "<div class='muted' style='margin-bottom:6px'>Ambiguities</div>";
  ambiguitiesEl.appendChild(list);
};

const analyzeImage = async () => {
  const file = imageInput.files?.[0];
  if (!file) {
    setStatus("Please select an image to analyze.", true);
    return;
  }
  const apiKey = getApiKey();
  if (!apiKey) {
    setStatus("Please enter your Gemini API key.", true);
    return;
  }

  setLoading(true);
  resetResults();
  setStatus("Analyzing image...", false);

  try {
    const ai = createClient(apiKey);
    const base64 = await fileToBase64(file);
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: file.type || "image/png",
            data: base64,
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const rawText = response.text?.trim() || "";
    if (!rawText) {
      throw new Error("Empty response from the model.");
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      throw new Error("The model returned invalid JSON. Try a clearer image.");
    }

    reasoningEl.textContent = parsed.reasoning || "—";
    renderItems(parsed.items);
    const totalValue = Number(parsed.totalCalculated);
    totalEl.textContent = Number.isFinite(totalValue) ? totalValue.toFixed(2) : "—";
    renderAmbiguities(parsed.ambiguities);
    setStatus("Done.", false);
  } catch (error) {
    setStatus(error?.message || "Something went wrong.", true);
  } finally {
    setLoading(false);
  }
};

analyzeBtn.addEventListener("click", analyzeImage);
imageInput.addEventListener("change", () => {
  setStatus("", false);
  resetResults();
});
