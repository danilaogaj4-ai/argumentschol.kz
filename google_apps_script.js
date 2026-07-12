// ==========================================================================
// Google Apps Script для сайта TheArgument
// Этот скрипт служит бэкендом и базой данных в Google Таблицах.
// ==========================================================================

// НАСТРОЙКА: Измените пароль для доступа к админ-панели
const ADMIN_PASSWORD = "admin"; 

// Точка входа для GET-запросов (получение данных)
function doGet(e) {
  try {
    var action = e.parameter.action;
    
    if (action === "registrations") {
      // Защита админки паролем
      var pass = e.parameter.password;
      if (pass !== ADMIN_PASSWORD) {
        return makeJsonResponse({ error: "Неверный пароль администратора" }, 401);
      }
      return makeJsonResponse(getRegistrations());
    } 
    
    else if (action === "user-status") {
      var phone = e.parameter.phone;
      if (!phone) {
        return makeJsonResponse({ error: "Не указан телефон" }, 400);
      }
      return makeJsonResponse(getUserStatus(phone));
    }
    
    return makeJsonResponse({ error: "Неверное действие (action)" }, 400);
  } catch (err) {
    return makeJsonResponse({ error: err.toString() }, 500);
  }
}

// Точка входа для POST-запросов (сохранение/изменение данных)
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return makeJsonResponse({ error: "Пустой запрос" }, 400);
    }
    
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === "register") {
      return makeJsonResponse(registerStudent(data));
    } 
    
    else if (action === "update-user-status") {
      var pass = data.password;
      if (pass !== ADMIN_PASSWORD) {
        return makeJsonResponse({ error: "Неверный пароль администратора" }, 401);
      }
      return makeJsonResponse(updateUserStatus(data));
    } 
    
    else if (action === "clear-registrations") {
      var pass = data.password;
      if (pass !== ADMIN_PASSWORD) {
        return makeJsonResponse({ error: "Неверный пароль администратора" }, 401);
      }
      return makeJsonResponse(clearRegistrations());
    }
    
    return makeJsonResponse({ error: "Неверное действие (action)" }, 400);
  } catch (err) {
    return makeJsonResponse({ error: err.toString() }, 500);
  }
}

// ==========================================================================
// Вспомогательные функции бэкенда
// ==========================================================================

// Функция формирования JSON-ответа с поддержкой CORS
function makeJsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// НАСТРОЙКА: Если скрипт развернут отдельно (не привязан к таблице через Расширения -> Apps Script),
// укажите здесь ID вашей Google Таблицы (из её URL-адреса)
const SPREADSHEET_ID = ""; 

// Проверка и создание листов, если их нет
function getOrCreateSheet(sheetName, headers) {
  var ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error("Не удалось получить активную таблицу. Пожалуйста, укажите SPREADSHEET_ID в коде скрипта.");
  }
  
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    // Делаем шапку жирной
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

// 1. Регистрация нового ученика
function registerStudent(data) {
  var sheet = getOrCreateSheet("Registrations", [
    "ID", "Имя", "Фамилия", "Номер телефона", "Удобное время", 
    "Уровень", "Формат", "Язык", "Выбранные лекции (Pro)", "Дата подачи"
  ]);
  
  var id = new Date().getTime().toString();
  var firstName = data.firstName || "";
  var lastName = data.lastName || "";
  var phone = data.phoneNumber || "";
  var slots = JSON.stringify(data.slots || []);
  var level = data.courseLevel || "Не выбран";
  var format = data.format || "Не выбран";
  var language = data.language || "Не выбран";
  var selectedLectures = JSON.stringify(data.selectedLectures || []);
  var timestamp = new Date().toISOString();
  
  sheet.appendRow([
    id, firstName, lastName, phone, slots, 
    level, format, language, selectedLectures, timestamp
  ]);
  
  // Добавляем/синхронизируем пользователя в список Users
  var usersSheet = getOrCreateSheet("Users", [
    "Номер телефона", "Имя", "Фамилия", "Статус доступа", "Дата обновления"
  ]);
  
  var userRow = findRowByValue(usersSheet, 1, phone);
  if (userRow === -1) {
    usersSheet.appendRow([
      phone, firstName, lastName, "Не куплен", timestamp
    ]);
  }
  
  return { success: true, message: "Заявка успешно добавлена" };
}

// 2. Получение списка всех заявок
function getRegistrations() {
  var sheet = getOrCreateSheet("Registrations", [
    "ID", "Имя", "Фамилия", "Номер телефона", "Удобное время", 
    "Уровень", "Формат", "Язык", "Выбранные лекции (Pro)", "Дата подачи"
  ]);
  
  var rows = sheet.getDataRange().getValues();
  var registrations = [];
  
  // Пропускаем шапку (i = 1)
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    
    // Безопасный парсинг JSON-массивов
    var slots = [];
    var selectedLectures = [];
    try { slots = JSON.parse(row[4]); } catch(e) {}
    try { selectedLectures = JSON.parse(row[8]); } catch(e) {}
    
    registrations.push({
      id: row[0].toString(),
      firstName: row[1],
      lastName: row[2],
      phoneNumber: row[3].toString(),
      slots: slots,
      courseLevel: row[5],
      format: row[6],
      language: row[7],
      selectedLectures: selectedLectures,
      timestamp: row[9]
    });
  }
  
  return registrations;
}

// 3. Получение статуса пользователя по телефону
function getUserStatus(phone) {
  var sheet = getOrCreateSheet("Users", [
    "Номер телефона", "Имя", "Фамилия", "Статус доступа", "Дата обновления"
  ]);
  
  var rowIdx = findRowByValue(sheet, 1, phone);
  if (rowIdx !== -1) {
    var status = sheet.getRange(rowIdx, 4).getValue();
    var name = sheet.getRange(rowIdx, 2).getValue();
    return { status: status, name: name };
  }
  
  return { status: "Не куплен", name: "" };
}

// 4. Обновление статуса пользователя администратором
function updateUserStatus(data) {
  var sheet = getOrCreateSheet("Users", [
    "Номер телефона", "Имя", "Фамилия", "Статус доступа", "Дата обновления"
  ]);
  
  var phone = data.phoneNumber;
  var status = data.status;
  var firstName = data.firstName || "Пользователь";
  var lastName = data.lastName || "";
  var timestamp = new Date().toISOString();
  
  if (!phone || !status) {
    throw new Error("Не указан телефон или статус");
  }
  
  var rowIdx = findRowByValue(sheet, 1, phone);
  if (rowIdx !== -1) {
    // Обновляем существующего
    sheet.getRange(rowIdx, 4).setValue(status);
    if (data.firstName) sheet.getRange(rowIdx, 2).setValue(firstName);
    if (data.lastName) sheet.getRange(rowIdx, 3).setValue(lastName);
    sheet.getRange(rowIdx, 5).setValue(timestamp);
  } else {
    // Создаем нового
    sheet.appendRow([phone, firstName, lastName, status, timestamp]);
  }
  
  return { success: true, message: "Статус успешно обновлен" };
}

// 5. Очистка всех заявок
function clearRegistrations() {
  var sheet = getOrCreateSheet("Registrations", [
    "ID", "Имя", "Фамилия", "Номер телефона", "Удобное время", 
    "Уровень", "Формат", "Язык", "Выбранные лекции (Pro)", "Дата подачи"
  ]);
  
  var numRows = sheet.getLastRow();
  if (numRows > 1) {
    // Удаляем всё со 2-й строки до конца
    sheet.deleteRows(2, numRows - 1);
  }
  return { success: true, message: "Все заявки удалены из таблицы" };
}

// Поиск строки по значению в колонке (колонка 1-indexed, возвращает 1-indexed строку или -1)
function findRowByValue(sheet, colIndex, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  
  var values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  var searchVal = value.toString().trim();
  
  for (var i = 0; i < values.length; i++) {
    if (values[i][0].toString().trim() === searchVal) {
      return i + 2; // +2 из-за смещения (1-индексация и пропуск шапки)
    }
  }
  return -1;
}
