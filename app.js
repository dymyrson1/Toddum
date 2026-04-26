import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDCbRzNiVVVYIRbdZFIK6U4qv-aIO4-iBY",
  authDomain: "toddum-7ac02.firebaseapp.com",
  projectId: "toddum-7ac02",
  storageBucket: "toddum-7ac02.firebasestorage.app",
  messagingSenderId: "470797866375",
  appId: "1:470797866375:web:e5853d9f709b89496a6f22"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});

// Тимчасові динамічні масиви.
// Пізніше ми будемо завантажувати їх із Firestore.
let customers = [];
let products = [];

// Стовпчики 8 і 9.
// Індекси рахуються з нуля: 0,1,2,3,4,5,6,7,8
const checkboxColumns = [6, 7];

let currentWeek = getCurrentWeek();
let isEditing = false;

const weekText = document.getElementById("weekText");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const lockBtn = document.getElementById("lockBtn");
const saveBtn = document.getElementById("saveBtn");
const previousWeekBtn = document.getElementById("previousWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");



function getCurrentWeek() {
  const now = new Date();

  const date = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ));

  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function updateWeekText() {
  weekText.textContent = "Тиждень " + currentWeek;
}

function renderTable() {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  const headerRow = document.createElement("tr");

  const weekHeader = document.createElement("th");
  weekHeader.className = "week-cell";
  weekHeader.textContent = "Тиждень " + currentWeek;
  headerRow.appendChild(weekHeader);

  products.forEach(product => {
    const th = document.createElement("th");
    th.textContent = product;
    headerRow.appendChild(th);
  });

  tableHead.appendChild(headerRow);

  customers.forEach(customer => {
    const row = document.createElement("tr");

    const customerCell = document.createElement("td");
    customerCell.className = "customer";
    customerCell.textContent = customer;
    row.appendChild(customerCell);

    products.forEach((product, productIndex) => {
      const cell = document.createElement("td");

      if (checkboxColumns.includes(productIndex)) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.disabled = true;
        cell.appendChild(checkbox);
      } else {
        cell.contentEditable = "false";
      }

      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}

function setEditable(state) {
  const editableCells = document.querySelectorAll("#orderTable tbody td[contenteditable]");
  const checkboxes = document.querySelectorAll("#orderTable tbody input[type='checkbox']");

  editableCells.forEach(cell => {
    cell.contentEditable = state ? "true" : "false";
  });

  checkboxes.forEach(checkbox => {
    checkbox.disabled = !state;
  });
}

function lockTable() {
  isEditing = false;
  setEditable(false);
  lockBtn.textContent = "🔒";
  lockBtn.title = "Розблокувати редагування";
  saveBtn.style.display = "none";
}

function unlockTable() {
  isEditing = true;
  setEditable(true);
  lockBtn.textContent = "🔓";
  lockBtn.title = "Заблокувати редагування";
  saveBtn.style.display = "inline-block";
}

function clearTableValues() {
  const rows = document.querySelectorAll("#orderTable tbody tr");

  rows.forEach(row => {
    const cells = row.querySelectorAll("td:not(.customer)");

    cells.forEach((cell, cellIndex) => {
      if (checkboxColumns.includes(cellIndex)) {
        const checkbox = cell.querySelector("input[type='checkbox']");
        if (checkbox) checkbox.checked = false;
      } else {
        cell.textContent = "";
      }
    });
  });
}

function collectTableData() {
  const rows = document.querySelectorAll("#orderTable tbody tr");

  const data = [];

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll("td:not(.customer)");

    const rowData = {
      customer: customers[rowIndex],
      values: []
    };

    cells.forEach((cell, cellIndex) => {
      if (checkboxColumns.includes(cellIndex)) {
        const checkbox = cell.querySelector("input[type='checkbox']");
        rowData.values.push(checkbox ? checkbox.checked : false);
      } else {
        rowData.values.push(cell.textContent.trim());
      }
    });

    data.push(rowData);
  });

  return data;
}

function fillTable(data) {
  const rows = document.querySelectorAll("#orderTable tbody tr");

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll("td:not(.customer)");
    const rowData = data?.[rowIndex]?.values || [];

    cells.forEach((cell, cellIndex) => {
      const value = rowData[cellIndex];

      if (checkboxColumns.includes(cellIndex)) {
        const checkbox = cell.querySelector("input[type='checkbox']");
        if (checkbox) checkbox.checked = value === true;
      } else {
        cell.textContent = value || "";
      }
    });
  });
}

async function loadTable() {
  clearTableValues();

  const docRef = doc(db, "weeks", "week_" + currentWeek);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const savedData = docSnap.data().data;
    fillTable(savedData);
  }
}

async function saveTable() {
  const data = collectTableData();

  let previewText = "Будуть збережені такі дані:\n\n";
  previewText += "Тиждень: " + currentWeek + "\n\n";

  data.forEach((row, index) => {
    const rowText = row.values
      .map(value => {
        if (value === true) return "✓";
        if (value === false) return "-";
        return value || "-";
      })
      .join(" | ");

    previewText += `${row.customer || "Замовник " + (index + 1)}: ${rowText}\n`;
  });

  const confirmed = confirm(previewText + "\nПідтвердити збереження?");

  if (!confirmed) {
    return;
  }

  await setDoc(doc(db, "weeks", "week_" + currentWeek), {
    week: currentWeek,
    customers: customers,
    products: products,
    checkboxColumns: checkboxColumns,
    data: data,
    updatedAt: serverTimestamp()
  });

  lockTable();

  alert("Дані збережено");
}

lockBtn.addEventListener("click", () => {
  if (isEditing) {
    lockTable();
  } else {
    unlockTable();
  }
});

saveBtn.addEventListener("click", async () => {
  await saveTable();
});

previousWeekBtn.addEventListener("click", async () => {
  if (currentWeek > 1) {
    lockTable();
    currentWeek--;
    updateWeekText();
    renderTable();
    await loadTable();
  }
});

nextWeekBtn.addEventListener("click", async () => {
  if (currentWeek < 53) {
    lockTable();
    currentWeek++;
    updateWeekText();
    renderTable();
    await loadTable();
  }
});

async function loadSettings() {
  const customersDoc = await getDoc(doc(db, "settings", "customers"));
  const productsDoc = await getDoc(doc(db, "settings", "products"));

  if (customersDoc.exists()) {
    customers = customersDoc.data().list || [];
  }

  if (productsDoc.exists()) {
    products = productsDoc.data().list || [];
  }
}

async function init() {
  updateWeekText();

  await loadSettings();   // ← нове

  renderTable();
  lockTable();

  await loadTable();
}

init();