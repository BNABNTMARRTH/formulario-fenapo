// CÓDIGO PARA GOOGLE APPS SCRIPT
// Abre tu hoja de cálculo -> Extensiones -> Apps Script
// Pega este código reemplazando todo el contenido y haz clic en Guardar (icono de disco).
// Luego, haz clic en "Implementar" -> "Nueva implementación".
// Elige tipo "Aplicación web".
// En "Quién tiene acceso", selecciona "Cualquier persona" (Anyone).
// Haz clic en "Implementar", autoriza los permisos y copia la URL de la aplicación web generada.

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("FENAPO");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No se encontró la pestaña FENAPO" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) {
    return h ? h.toString().trim().toUpperCase() : "";
  });
  
  var nombreIdx = headers.indexOf("NOMBRE");
  var negocioIdx = headers.indexOf("NEGOCIO /GIRO");
  var ubicacionIdx = headers.indexOf("UBICACION");
  var respuestaIdx = headers.indexOf("RESPUESTA NEGOCIO");
  
  // Fallback de negocio por si hay discrepancias de nombres
  if (negocioIdx === -1) {
    for (var col = 0; col < headers.length; col++) {
      if (headers[col].indexOf("NEGOCIO") > -1 || headers[col].indexOf("GIRO") > -1) {
        negocioIdx = col;
        break;
      }
    }
  }
  
  var negocios = [];         // Negocios pendientes por confirmar
  var confirmados = [];      // Negocios que ya aceptaron y tienen coordenadas
  var totalAceptados = 0;
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var nombre = row[nombreIdx] ? row[nombreIdx].toString().trim() : "";
    var negocio = row[negocioIdx] ? row[negocioIdx].toString().trim() : "";
    var ubicacion = row[ubicacionIdx] ? row[ubicacionIdx].toString().trim() : "";
    var respuesta = row[respuestaIdx] ? row[respuestaIdx].toString().trim().toUpperCase() : "";
    var fechaHora = row[10] ? row[10].toString().trim() : ""; // Columna K (índice 10 en array 0-indexed)
    
    // Contamos si ya aceptaron
    if (respuesta === "ACEPTO" || respuesta === "SI") {
      totalAceptados++;
      
      // Si tiene coordenadas, lo agregamos a confirmados para pintar el pin en el mapa
      if (ubicacion) {
        var coords = ubicacion.split(",");
        if (coords.length === 2) {
          confirmados.push({
            negocio: negocio,
            nombre: nombre,
            lat: parseFloat(coords[0].trim()),
            lng: parseFloat(coords[1].trim()),
            fechaHora: fechaHora
          });
        }
      }
    } else if (respuesta === "NO ACEPTO") {
      // Declinado
    } else if (negocio !== "") {
      negocios.push({
        row: i + 1,
        nombre: nombre,
        negocio: negocio
      });
    }
  }
  
  var cupoMaximo = 30;
  var disponibles = Math.max(0, cupoMaximo - totalAceptados);
  
  var result = {
    disponibles: disponibles,
    aceptados: totalAceptados,
    negocios: negocios,
    confirmados: confirmados
  };
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("FENAPO");
    var rowNum = parseInt(params.row);
    var lat = params.lat;
    var lng = params.lng;
    var respuesta = params.respuesta; // Recibe "ACEPTO" o "NO ACEPTO"
    
    var headers = sheet.getDataRange().getValues()[0].map(function(h) {
      return h ? h.toString().trim().toUpperCase() : "";
    });
    
    // Buscar columnas por nombre normalizado
    var ubicacionCol = headers.indexOf("UBICACION") + 1;
    var respuestaCol = headers.indexOf("RESPUESTA NEGOCIO") + 1;
    var registroCol = headers.indexOf("REGISTRO") + 1;
    
    // Si no encuentra los nombres exactos, asignar por posición fija basada en tu captura:
    // I: UBICACION (9), J: RESPUESTA NEGOCIO (10), K: REGISTRO (11)
    if (ubicacionCol === 0) ubicacionCol = 8; // Columna I
    if (respuestaCol === 0) respuestaCol = 10; // Columna J
    if (registroCol === 0) registroCol = 11; // Columna K
    
    // Escribir coordenadas en columna I (UBICACION)
    sheet.getRange(rowNum, ubicacionCol).setValue(lat + ", " + lng);
    
    // Escribir la respuesta (ACEPTO / NO ACEPTO) en columna J (RESPUESTA NEGOCIO)
    sheet.getRange(rowNum, respuestaCol).setValue(respuesta);
    
    // Escribir la fecha y hora en columna K (REGISTRO)
    var formattedDate = Utilities.formatDate(new Date(), "America/Mexico_City", "dd/MM/yyyy HH:mm:ss");
    sheet.getRange(rowNum, registroCol).setValue(formattedDate);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", datetime: formattedDate }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Soporte para CORS preflight OPTIONS
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
