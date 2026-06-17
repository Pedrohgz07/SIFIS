// ── Estado global ────────────────────────────────────────────────────────────
const state = {
  captchaOk: false,
  archivo: null,
};

// ── Utilidades de pantalla ───────────────────────────────────────────────────
function mostrarPantalla(id) {
  document.querySelectorAll(".pantalla").forEach((p) => p.classList.remove("activa"));
  document.getElementById(id).classList.add("activa");
}

// ── Captcha ──────────────────────────────────────────────────────────────────
function onCaptchaSuccess() {
  state.captchaOk = true;
  document.getElementById("btn-analizar").disabled = false;
}

// ── Zona de subida ───────────────────────────────────────────────────────────
const zonaSubida = document.getElementById("zonaSubida");
const inputImagen = document.getElementById("inputImagen");
const btnAnalizar = document.getElementById("btn-analizar");

// Click en botón abre el selector de archivo
btnAnalizar.addEventListener("click", () => {
  inputImagen.click();
});

// Drag & Drop
zonaSubida.addEventListener("dragover", (e) => {
  e.preventDefault();
  zonaSubida.classList.add("drag-over");
});

zonaSubida.addEventListener("dragleave", () => {
  zonaSubida.classList.remove("drag-over");
});

zonaSubida.addEventListener("drop", (e) => {
  e.preventDefault();
  zonaSubida.classList.remove("drag-over");
  if (!state.captchaOk) return;
  const file = e.dataTransfer.files[0];
  if (file) procesarArchivo(file);
});

// Selección normal
inputImagen.addEventListener("change", () => {
  const file = inputImagen.files[0];
  if (file) procesarArchivo(file);
});

// ── Procesar archivo seleccionado ────────────────────────────────────────────
function procesarArchivo(file) {
  const permitidos = ["image/jpeg", "image/png", "image/webp"];
  if (!permitidos.includes(file.type)) {
    alert("Formato no permitido. Usa JPG, PNG o WEBP.");
    return;
  }

  state.archivo = file;

  // Mostrar preview en pantalla de análisis
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewAnalisis = document.getElementById("preview-analisis");
    const placeholder = document.getElementById("placeholder-analisis");
    previewAnalisis.src = e.target.result;
    previewAnalisis.style.display = "block";
    placeholder.style.display = "none";

    // También preparar preview de resultados
    document.getElementById("preview-resultado").src = e.target.result;
    document.getElementById("preview-resultado").style.display = "block";
  };
  reader.readAsDataURL(file);

  mostrarPantalla("pantalla-analisis");
  iniciarAnimacionPasos();
  enviarImagen(file);
}

// ── Animación de pasos ───────────────────────────────────────────────────────
function iniciarAnimacionPasos() {
  const pasos = [1, 2, 3, 4];
  const duraciones = [800, 1000, 2000, 600]; // ms por paso

  pasos.forEach((num) => {
    const paso = document.getElementById(`paso-${num}`);
    const barra = document.getElementById(`barra-${num}`);
    const estado = paso.querySelector(".paso-estado");
    estado.textContent = "En espera";
    barra.style.width = "0%";
    paso.classList.remove("activo", "completado");
  });

  let acumulado = 0;
  pasos.forEach((num, i) => {
    const delay = acumulado;
    acumulado += duraciones[i];

    setTimeout(() => {
      const paso = document.getElementById(`paso-${num}`);
      const barra = document.getElementById(`barra-${num}`);
      const estado = paso.querySelector(".paso-estado");

      paso.classList.add("activo");
      estado.textContent = "Procesando...";
      barra.style.transition = `width ${duraciones[i]}ms ease`;
      barra.style.width = "100%";
    }, delay);

    setTimeout(() => {
      const paso = document.getElementById(`paso-${num}`);
      const estado = paso.querySelector(".paso-estado");
      paso.classList.remove("activo");
      paso.classList.add("completado");
      estado.textContent = "Completado";
    }, acumulado);
  });
}

// ── Enviar imagen al backend ─────────────────────────────────────────────────
async function enviarImagen(file) {
  const formData = new FormData();
  formData.append("imagen", file);

  try {
    const res = await fetch("/analizar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (data.error) {
      alert("Error: " + data.error);
      reiniciar();
      return;
    }

    // Esperar a que terminen las animaciones (~4.5s) antes de mostrar resultados
    const tiempoAnimacion = 4500;
    const tiempoReal = (data.tiempo || 0) * 1000;
    const espera = Math.max(tiempoAnimacion - tiempoReal, 0);

    setTimeout(() => mostrarResultados(data), espera);
  } catch (err) {
    alert("No se pudo conectar con el servidor.");
    reiniciar();
  }
}

// ── Mostrar resultados ───────────────────────────────────────────────────────
function mostrarResultados(data) {
  const esIA = data.prediccion === "IA";

  // Banner
  const banner = document.getElementById("resultado-banner");
  banner.className = "resultado-banner" + (esIA ? " falsa" : "");

  document.getElementById("banner-num").textContent = esIA ? "IA" : "R";
  document.getElementById("banner-titulo").textContent = esIA ? "Imagen generada por IA" : "Imagen real";
  document.getElementById("banner-sub").textContent = esIA
    ? "Generada artificialmente"
    : "Fotografía auténtica";
  document.getElementById("banner-pct").textContent = data.confianza + "%";

  // Métricas
  document.getElementById("met-confianza").textContent = data.confianza + "%";
  document.getElementById("met-ela").textContent = data.ela_score;
  document.getElementById("met-anomalias").textContent = data.anomalias;
  document.getElementById("met-tiempo").textContent = data.tiempo + "s";

  // Descripción
  const desc = document.getElementById("descripcion-box");
  desc.textContent = esIA
    ? `El modelo detectó patrones característicos de imágenes sintéticas con un ${data.confianza}% de confianza. El análisis ELA reveló ${data.anomalias} zonas con inconsistencias de compresión.`
    : `No se detectaron patrones artificiales. El modelo clasificó la imagen como auténtica con un ${data.confianza}% de confianza.`;

  mostrarPantalla("pantalla-resultado");
}

// ── Reiniciar ────────────────────────────────────────────────────────────────
function reiniciar() {
  state.archivo = null;
  state.captchaOk = false;
  inputImagen.value = "";
  document.getElementById("btn-analizar").disabled = true;

  // Reset preview
  const previewAnalisis = document.getElementById("preview-analisis");
  previewAnalisis.src = "";
  previewAnalisis.style.display = "none";
  document.getElementById("placeholder-analisis").style.display = "flex";

  // Reset resultado
  document.getElementById("preview-resultado").src = "";

  // Resetear captcha de Cloudflare
  if (window.turnstile) window.turnstile.reset();

  mostrarPantalla("pantalla-inicio");
}

// ── Exponer al scope global (necesario para onclick en HTML y Turnstile) ─────
window.SIFIS = {
  captcha: { onSuccess: onCaptchaSuccess },
  reiniciar,
};