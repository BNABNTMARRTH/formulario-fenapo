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
    var fechaHora = row[9] ? row[9].toString().trim() : ""; // Columna J (índice 9 en array 0-indexed)
    
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
    
    var ubicacionCol = headers.indexOf("UBICACION") + 1;
    var respuestaCol = headers.indexOf("RESPUESTA NEGOCIO") + 1;
    
    // Fallback para buscar columnas si no son exactas
    if (respuestaCol === 0) {
      for (var col = 0; col < headers.length; col++) {
        if (headers[col].indexOf("RESPUESTA") > -1) {
          respuestaCol = col + 1;
          break;
        }
      }
    }
    
    if (ubicacionCol > 0 && respuestaCol > 0) {
      // Escribir coordenadas y respuesta (ACEPTO/NO ACEPTO)
      sheet.getRange(rowNum, ubicacionCol).setValue(lat + ", " + lng);
      sheet.getRange(rowNum, respuestaCol).setValue(respuesta);
      
      // Escribir la marca de tiempo de registro en la Columna J (Columna número 10)
      var formattedDate = Utilities.formatDate(new Date(), "America/Mexico_City", "dd/MM/yyyy HH:mm:ss");
      sheet.getRange(rowNum, 10).setValue(formattedDate);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", datetime: formattedDate }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Columnas 'UBICACION' o 'RESPUESTA NEGOCIO' no encontradas" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
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
