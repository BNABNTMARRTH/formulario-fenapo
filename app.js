// URL de la aplicación web de producción de Google Apps Script
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzYCC54kxqpDYlwSZPAcJKY7V5jz2sqTwrTVVKNyCC2XZW_eDL3fcLHEwIJIcj5Zfx9/exec";

// Coordenadas iniciales especificadas por el usuario (Instalaciones FENAPO)
const DEFAULT_LAT = 22.108098;
const DEFAULT_LNG = -100.954385;

let map;
let marker;
let allBusinesses = [];
let selectedBusiness = null;
let confirmedMarkers = []; // Array para almacenar los pines de negocios ya confirmados
let baseDisponibles = 30;  // Guardar la disponibilidad base que viene del servidor

// Elementos del DOM
const businessSelect = document.getElementById("business-select");
const availableCountEl = document.getElementById("available-count");
const progressBar = document.getElementById("progress-bar");
const latPreview = document.getElementById("lat-preview");
const lngPreview = document.getElementById("lng-preview");
const submitBtn = document.getElementById("submit-btn");
const btnSpinner = document.getElementById("btn-spinner");
const btnText = document.getElementById("btn-text");

// Pantallas
const inputScreen = document.getElementById("input-screen");
const confirmDialogScreen = document.getElementById("confirm-dialog-screen");
const successScreen = document.getElementById("success-screen");

// Resumen y botones del diálogo
const businessSummaryCard = document.getElementById("business-summary-card");
const confirmYesBtn = document.getElementById("confirm-yes-btn");
const confirmNoBtn = document.getElementById("confirm-no-btn");
const yesSpinner = document.getElementById("yes-spinner");
const noSpinner = document.getElementById("no-spinner");

// Éxito final
const successIconContainer = document.getElementById("success-icon-container");
const successTitle = document.getElementById("success-title");
const successMessage = document.getElementById("success-message");

const locationForm = document.getElementById("location-form");

// Función para crear un icono SVG con el color deseado en formato Leaflet.divIcon
function createColoredIcon(color, className = "") {
  return L.divIcon({
    className: 'custom-colored-pin',
    html: `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" style="display: block;">
             <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
           </svg>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -32]
  });
}

// Inicializar Mapa de Leaflet
function initMap() {
  map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LNG], 17);

  // Cargamos OpenStreetMap estándar sin invertir colores (Mapa blanco/claro original)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Marcador activo inicial: Color Rosa Fucsia característico con animación de rebote continua
  // zIndexOffset: 99999 garantiza que siempre se renderice al frente de los pines fijos
  marker = L.marker([DEFAULT_LAT, DEFAULT_LNG], {
    draggable: true,
    zIndexOffset: 99999,
    icon: createColoredIcon("#ff007f", "active-bounce-pin") // Marcador activo en fucsia
  }).addTo(map);

  marker.on('dragend', function () {
    const position = marker.getLatLng();
    updateCoordinates(position.lat, position.lng);
  });

  map.on('click', function (e) {
    marker.setLatLng(e.latlng);
    updateCoordinates(e.latlng.lat, e.latlng.lng);
  });

  updateCoordinates(DEFAULT_LAT, DEFAULT_LNG);
}

function updateCoordinates(lat, lng) {
  latPreview.textContent = lat.toFixed(6);
  lngPreview.textContent = lng.toFixed(6);
}

// Colores únicos para cada pin confirmado (sin repetirse)
const pinColors = [
  "#22c55e", // Verde esmeralda
  "#06b6d4", // Cyan
  "#3b82f6", // Azul
  "#8b5cf6", // Violeta
  "#f43f5e", // Rosa
  "#eab308", // Amarillo
  "#f97316", // Naranja
  "#14b8a6", // Verde azulado
  "#ec4899", // Magenta
  "#6b7280"  // Gris
];

// Dibujar en el mapa los marcadores de negocios ya confirmados con colores diferentes
function drawConfirmedMarkers(confirmados) {
  // Limpiar marcadores confirmados anteriores si existen
  confirmedMarkers.forEach(m => map.removeLayer(m));
  confirmedMarkers = [];

  if (!confirmados) return;

  confirmados.forEach((c, index) => {
    // Escoger un color diferente secuencial del array de colores
    const color = pinColors[index % pinColors.length];
    
    // Crear marcador estático con el color específico
    const m = L.marker([c.lat, c.lng], {
      icon: createColoredIcon(color)
    }).addTo(map);
    
    m.bindPopup(`
      <div style="font-family: 'Outfit', sans-serif; color: #0a0b10; min-width: 140px;">
        <strong style="color: #ff007f; font-size: 0.95rem;">${c.negocio}</strong><br/>
        <span style="font-size: 0.85rem; color: #555;">Resp: ${c.nombre}</span><br/>
        <span style="font-size: 0.75rem; color: #888;">Registrado: ${c.fechaHora || 'N/D'}</span>
      </div>
    `);
    confirmedMarkers.push(m);
  });
}

// Cargar la lista de negocios
async function loadData() {
  if (WEB_APP_URL.includes("XXXXXXXXXXXX")) {
    console.warn("Usando datos de prueba. Configura tu WEB_APP_URL.");
    showDemoData();
    return;
  }

  try {
    const response = await fetch(WEB_APP_URL);
    if (!response.ok) throw new Error("Respuesta de red no satisfactoria.");
    
    const data = await response.json();
    
    // Guardar disponibilidad base
    baseDisponibles = data.disponibles;
    updateCounter(baseDisponibles);
    
    // Dibujar pines de negocios ya confirmados
    drawConfirmedMarkers(data.confirmados);
    
    // Llenar el selector de negocios
    allBusinesses = data.negocios || [];
    populateBusinessSelect();

  } catch (error) {
    console.error("Error al cargar datos desde el Apps Script real:", error);
    alert("No se pudo conectar a la base de datos de Google Sheets. Asegúrate de haber implementado el script como 'Aplicación Web' y que tenga acceso para 'Cualquier persona' (Anyone).");
    showDemoData();
  }
}

// Evento al seleccionar un negocio: restar 1 al contador temporalmente
businessSelect.addEventListener("change", () => {
  if (businessSelect.value) {
    // Restamos 1 al contador base para mostrar que se ocupará ese espacio
    updateCounter(baseDisponibles - 1);
  } else {
    // Si deselecciona, regresa al valor base
    updateCounter(baseDisponibles);
  }
});

function updateCounter(disponibles) {
  availableCountEl.textContent = disponibles;
  const totalCupos = 30;
  const ocupados = Math.max(0, totalCupos - disponibles);
  const porcentaje = (ocupados / totalCupos) * 100;
  progressBar.style.width = `${porcentaje}%`;
}

function showDemoData() {
  baseDisponibles = 18;
  updateCounter(baseDisponibles);
  allBusinesses = [
    { row: 2, negocio: "Botanas campesinas", nombre: "Katia Ruiz Cerda" },
    { row: 3, negocio: "LAS MICHES", nombre: "Víctor Hugo Ramírez castillo" },
    { row: 4, negocio: "Don Ballenon", nombre: "Yazmin betancourt" },
    { row: 5, negocio: "Century y 21 Sinow", nombre: "Jose Luis Martinez Fabián" }
  ];
  
  // Dibujar unos pines de prueba
  drawConfirmedMarkers([
    { negocio: "totalplay", nombre: "Iris del Rayo ejemplo", lat: 22.1085, lng: -100.9540, fechaHora: "25/07/2026 14:15:30" }
  ]);
  
  businessSelect.innerHTML = '<option value="" disabled selected>-- Selecciona tu negocio (MODO DEMO) --</option>';
  allBusinesses.forEach(item => {
    const option = document.createElement("option");
    option.value = item.row;
    option.textContent = `${item.negocio} (${item.nombre})`;
    businessSelect.appendChild(option);
  });
  businessSelect.disabled = false;
  submitBtn.disabled = false;
}

// Paso 1: Confirmar Ubicación (avanzar a confirmación)
locationForm.addEventListener("submit", function (e) {
  e.preventDefault();
 
  const selectedRow = businessSelect.value;
  const selectedService = document.getElementById("service-select").value;
  
  if (!selectedRow) {
    alert("Por favor selecciona tu negocio.");
    return;
  }
  if (!selectedService) {
    alert("Por favor selecciona un paquete de servicio de Totalplay.");
    return;
  }

  // Buscar objeto del negocio seleccionado
  selectedBusiness = allBusinesses.find(b => b.row == selectedRow);
  
  // Guardar el servicio seleccionado en el objeto
  selectedBusiness.servicio = selectedService;
 
  // Mostrar pantalla intermedia de confirmación
  inputScreen.style.display = "none";
  confirmDialogScreen.style.display = "block";
 
  // Llenar resumen del negocio
  businessSummaryCard.innerHTML = `
    <div class="summary-item">
      <div class="summary-label">Negocio / Giro</div>
      <div class="summary-val">${selectedBusiness.negocio}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Responsable</div>
      <div class="summary-val">${selectedBusiness.nombre}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Servicio Totalplay</div>
      <div class="summary-val" style="color: #ff007f; font-weight: 600;">${selectedBusiness.servicio}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Coordenadas a Registrar</div>
      <div class="summary-val" style="font-family: monospace; font-size: 0.95rem;">
        ${marker.getLatLng().lat.toFixed(6)}, ${marker.getLatLng().lng.toFixed(6)}
      </div>
    </div>
  `;
});
 
// Guardar en la hoja de cálculo
async function sendToSheets(respuesta) {
  const lat = marker.getLatLng().lat;
  const lng = marker.getLatLng().lng;
 
  if (WEB_APP_URL.includes("XXXXXXXXXXXX")) {
    // Simular envío
    return new Promise((resolve) => setTimeout(() => {
      resolve({ status: "success", datetime: new Date().toLocaleString() });
    }, 1000));
  }
 
  const response = await fetch(WEB_APP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      row: selectedBusiness.row,
      lat: lat,
      lng: lng,
      respuesta: respuesta,
      servicio: selectedBusiness.servicio // Enviamos el servicio
    })
  });
 
  // Al usar no-cors, la respuesta es opaca. Generamos la fecha local.
  return { status: "success", datetime: new Date().toLocaleString("es-MX") };
}

// Acción: Sí continuar
confirmYesBtn.addEventListener("click", async () => {
  confirmYesBtn.disabled = true;
  confirmNoBtn.disabled = true;
  yesSpinner.style.display = "inline-block";

  try {
    await sendToSheets("ACEPTO");

    // Remover negocio confirmado de la memoria local y actualizar el selector
    allBusinesses = allBusinesses.filter(b => b.row != selectedBusiness.row);
    populateBusinessSelect();

    // Configurar pantalla de éxito final
    successIconContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success-color);"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
    `;
    successTitle.textContent = "¡Registro de ubicación Exitoso!";
    successMessage.textContent = `Tu lugar para el negocio "${selectedBusiness.negocio}" ha sido enviado de forma correcta con estado: ACEPTO.`;

    confirmDialogScreen.style.display = "none";
    successScreen.style.display = "block";
  } catch (error) {
    console.error(error);
    alert("Hubo un problema al guardar la aceptación. Revisa tu conexión.");
    confirmYesBtn.disabled = false;
    confirmNoBtn.disabled = false;
    yesSpinner.style.display = "none";
  }
});

// Acción: No continuar
confirmNoBtn.addEventListener("click", async () => {
  confirmYesBtn.disabled = true;
  confirmNoBtn.disabled = true;
  noSpinner.style.display = "inline-block";

  try {
    const sheetResult = await sendToSheets("NO ACEPTO");
    const now = sheetResult.datetime || new Date().toLocaleString("es-MX");

    // Remover negocio de la lista local y actualizar el selector
    allBusinesses = allBusinesses.filter(b => b.row != selectedBusiness.row);
    populateBusinessSelect();

    // Preparar mensaje de WhatsApp
    const whatsappNum = "524401050758"; // Prefijo de país para México
    const textMsg = `Hola, se ha registrado una declinación en el formulario de FENAPO Totalplay:
*Negocio:* ${selectedBusiness.negocio}
*Responsable:* ${selectedBusiness.nombre}
*Respuesta:* NO ACEPTO
*Fecha/Hora:* ${now}
*Coordenadas:* ${marker.getLatLng().lat.toFixed(6)}, ${marker.getLatLng().lng.toFixed(6)}`;

    // Redirigir/abrir enlace de WhatsApp API
    const waUrl = `https://api.whatsapp.com/send?phone=${whatsappNum}&text=${encodeURIComponent(textMsg)}`;
    window.open(waUrl, "_blank");

    // Configurar pantalla final de declinación
    successIconContainer.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    `;
    successTitle.textContent = "Registro Guardado";
    successTitle.style.color = "#ef4444";
    successMessage.textContent = `Has declinado continuar con el proceso. Hemos guardado la respuesta "NO ACEPTO" y se ha generado la alerta por WhatsApp.`;

    confirmDialogScreen.style.display = "none";
    successScreen.style.display = "block";

  } catch (error) {
    console.error(error);
    alert("Hubo un problema al guardar la declinación.");
    confirmYesBtn.disabled = false;
    confirmNoBtn.disabled = false;
    noSpinner.style.display = "none";
  }
});

// Función auxiliar para repoblar el selector select
function populateBusinessSelect() {
  businessSelect.innerHTML = '<option value="" disabled selected>-- Selecciona tu negocio --</option>';
  if (allBusinesses.length > 0) {
    allBusinesses.forEach(item => {
      const option = document.createElement("option");
      option.value = item.row;
      option.textContent = `${item.negocio} (${item.nombre})`;
      businessSelect.appendChild(option);
    });
    businessSelect.disabled = false;
    submitBtn.disabled = false;
  } else {
    businessSelect.innerHTML = '<option value="" disabled>Todos los negocios ya han confirmado</option>';
    businessSelect.disabled = true;
    submitBtn.disabled = true;
  }
}

// Lógica de pantalla completa para el mapa
const toggleFullscreenBtn = document.getElementById("toggle-fullscreen-btn");
const closeFullscreenBtn = document.getElementById("close-fullscreen-btn");
const mapWrapper = document.getElementById("map-wrapper");
const fullscreenBtnText = document.getElementById("fullscreen-btn-text");

function toggleFullscreen(forceClose = false) {
  let isFullscreen;
  if (forceClose) {
    mapWrapper.classList.remove("fullscreen");
    isFullscreen = false;
  } else {
    isFullscreen = mapWrapper.classList.toggle("fullscreen");
  }
  
  if (isFullscreen) {
    fullscreenBtnText.textContent = "Salir de Completa";
    closeFullscreenBtn.style.display = "inline-block";
  } else {
    fullscreenBtnText.textContent = "Pantalla Completa";
    closeFullscreenBtn.style.display = "none";
  }
  
  // Re-calcular tamaño del mapa Leaflet tras cambio de tamaño del DOM
  setTimeout(() => {
    map.invalidateSize();
  }, 150);
}

toggleFullscreenBtn.addEventListener("click", () => toggleFullscreen());
closeFullscreenBtn.addEventListener("click", () => toggleFullscreen(true));

// Inicializar al cargar la página
window.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadData();
});
