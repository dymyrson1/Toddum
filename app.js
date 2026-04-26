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

let currentWeek = getCurrentWeek();
let isEditing = false;

const weekCell = document.getElementById("weekCell");
const weekText = document.getElementById("weekText");
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

  const weekNo = Math.ceil(
    (((date - yearStart) / 86400000) + 1) / 7
  );

  return weekNo;
}

function updateWeekText() {
  weekCell.textContent = "Тиждень " + currentWeek;
  weekText.textContent = "Тиждень " + currentWeek;
}

function setEditable(state) {
  const cells = document.querySelectorAll("td[contenteditable]");

  cells.forEach(cell => {
    cell.contentEditable = state ? "true" : "false";
  });
}

function lockTable() {
  isEditing = false;
  setEditable(false);
  lockBtn.textContent = "🔒";
  saveBtn.style.display = "none";
}

function unlockTable() {
  isEditing = true;
  setEditable(true);
  lockBtn.textContent = "🔓";
  saveBtn.style.display = "inline-block";
}

function clearTable() {
  const cells = document.querySelectorAll("#orderTable tbody td:not(.customer)");

  cells.forEach(cell => {
    cell.textContent = "";
  });
}

function collectTableData() {
  const rows = document.querySelectorAll("#orderTable tbody tr");

  const data = [];

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll("td:not(.customer)");

    const rowData = {
      customer: "Замовник " + (rowIndex + 1),
      values: []
    };

    cells.forEach(cell => {
      rowData.values.push(cell.textContent.trim());
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
      cell.textContent = rowData[cellIndex] || "";
    });
  });
}

async function loadTable() {
  clearTable();

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
        .map(value => value || "-")
        .join(" | ");

    previewText += `${row.customer || "Замовник " + (index + 1)}: ${rowText}\n`;
    });

  const confirmed = confirm(previewText + "\nПідтвердити збереження?");

  if (!confirmed) {
    return;
  }

  await setDoc(doc(db, "weeks", "week_" + currentWeek), {
    week: currentWeek,
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
    await loadTable();
  }
});

nextWeekBtn.addEventListener("click", async () => {
  if (currentWeek < 53) {
    lockTable();
    currentWeek++;
    updateWeekText();
    await loadTable();
  }
});

updateWeekText();
lockTable();
loadTable();