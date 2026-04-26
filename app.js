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

let customers = [];
let products = [];

const checkboxColumns = [6, 7];
const weekCache = new Map();

let currentWeek = getCurrentWeek();
let isEditing = false;

const weekText = document.getElementById("weekText");
const tableHead = document.getElementById("tableHead");
const tableBody = document.getElementById("tableBody");
const lockBtn = document.getElementById("lockBtn");
const saveBtn = document.getElementById("saveBtn");
const previousWeekBtn = document.getElementById("previousWeekBtn");
const nextWeekBtn = document.getElementById("nextWeekBtn");
const tableWrapper = document.querySelector(".table-wrapper");

/* ===== WEEK ===== */

function getCurrentWeek() {
  const now = new Date();

  const date = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );

  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function updateWeekText() {
  weekText.textContent = "Uke " + currentWeek;
}

/* ===== ANIMATION ===== */

function animateWeekChange(direction) {
  if (!tableWrapper) return;

  tableWrapper.classList.remove("slide-left", "slide-right");

  void tableWrapper.offsetWidth;

  tableWrapper.classList.add(
    direction === "next" ? "slide-left" : "slide-right"
  );
}

/* ===== TABLE ===== */

function renderTable() {
  tableHead.innerHTML = "";
  tableBody.innerHTML = "";

  const headerRow = document.createElement("tr");

  const weekHeader = document.createElement("th");
  weekHeader.className = "week-cell";
  weekHeader.textContent = "Uke " + currentWeek;
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

        checkbox.addEventListener("change", async () => {
          await handleCheckboxChange(checkbox);
        });

        cell.appendChild(checkbox);
      } else {
        cell.contentEditable = "false";
      }

      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });
}

/* ===== EDIT ===== */

function setEditable(state) {
  const editableCells = document.querySelectorAll(
    "#orderTable tbody td[contenteditable]"
  );

  editableCells.forEach(cell => {
    cell.contentEditable = state ? "true" : "false";
  });
}

function lockTable() {
  isEditing = false;
  setEditable(false);

  lockBtn.textContent = "🔒";
  lockBtn.title = "Lås opp redigering";

  saveBtn.style.display = "none";
}

function unlockTable() {
  isEditing = true;
  setEditable(true);

  lockBtn.textContent = "🔓";
  lockBtn.title = "Lås redigering";

  saveBtn.style.display = "inline-block";
}

/* ===== DATA ===== */

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

async function loadTable(week = currentWeek) {
  clearTableValues();

  if (weekCache.has(week)) {
    fillTable(weekCache.get(week));
    return;
  }

  const docRef = doc(db, "weeks", "week_" + week);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const savedData = docSnap.data().data || [];
    weekCache.set(week, savedData);

    if (week === currentWeek) {
      fillTable(savedData);
    }
  } else {
    weekCache.set(week, []);

    if (week === currentWeek) {
      clearTableValues();
    }
  }
}

function preloadNeighborWeeks() {
  const weeksToPreload = [
    currentWeek - 1,
    currentWeek + 1
  ].filter(week => week >= 1 && week <= 53 && !weekCache.has(week));

  weeksToPreload.forEach(week => {
    const docRef = doc(db, "weeks", "week_" + week);

    getDoc(docRef).then(docSnap => {
      if (docSnap.exists()) {
        weekCache.set(week, docSnap.data().data || []);
      } else {
        weekCache.set(week, []);
      }
    });
  });
}

async function saveTableSilently() {
  const data = collectTableData();

  weekCache.set(currentWeek, data);

  await setDoc(doc(db, "weeks", "week_" + currentWeek), {
    week: currentWeek,
    customers: customers,
    products: products,
    checkboxColumns: checkboxColumns,
    data: data,
    updatedAt: serverTimestamp()
  });
}

/* ===== EVENTS ===== */

async function handleCheckboxChange(checkbox) {
  const newValue = checkbox.checked;
  const oldValue = !newValue;

  const confirmed = confirm("Vil du lagre denne endringen?");

  if (!confirmed) {
    checkbox.checked = oldValue;
    return;
  }

  await saveTableSilently();
}

async function saveTable() {
  const data = collectTableData();

  const confirmed = confirm("Bekreft lagring?");
  if (!confirmed) return;

  weekCache.set(currentWeek, data);

  await setDoc(doc(db, "weeks", "week_" + currentWeek), {
    week: currentWeek,
    customers: customers,
    products: products,
    checkboxColumns: checkboxColumns,
    data: data,
    updatedAt: serverTimestamp()
  });

  lockTable();
}

/* ===== BUTTONS ===== */

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

previousWeekBtn.addEventListener("click", () => {
  if (currentWeek > 1) {
    lockTable();

    currentWeek--;
    updateWeekText();

    renderTable();
    animateWeekChange("prev");

    loadTable(currentWeek).then(() => {
      preloadNeighborWeeks();
    });
  }
});

nextWeekBtn.addEventListener("click", () => {
  if (currentWeek < 53) {
    lockTable();

    currentWeek++;
    updateWeekText();

    renderTable();
    animateWeekChange("next");

    loadTable(currentWeek).then(() => {
      preloadNeighborWeeks();
    });
  }
});

/* ===== SETTINGS ===== */

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

/* ===== INIT ===== */

async function init() {
  updateWeekText();

  await loadSettings();

  renderTable();
  lockTable();

  await loadTable(currentWeek);
  preloadNeighborWeeks();
}

init();