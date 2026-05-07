
const STORAGE_KEY = "public_housing_access_control_v1";

const statusText = {
  resident: {
    active: "啟用",
    inactive: "停用"
  },
  visitor: {
    pending: "待審核",
    approved: "已核准",
    checked_in: "已入場",
    checked_out: "已離場",
    rejected: "已拒絕"
  },
  door: {
    locked: "已鎖定",
    unlocked: "解鎖中",
    offline: "離線"
  }
};

function seedState() {
  const now = new Date();
  const t = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

  return {
    operator: "中控室管理員",
    emergencyMode: false,
    residents: [
      {
        id: "resident-1",
        name: "王小明",
        unit: "A 棟 8F-02",
        phone: "0912-111-222",
        cardId: "CARD-A802",
        pin: "2580",
        status: "active",
        createdAt: t(6200),
        lastAccessAt: t(35)
      },
      {
        id: "resident-2",
        name: "陳雅婷",
        unit: "B 棟 12F-01",
        phone: "0922-222-333",
        cardId: "CARD-B1201",
        pin: "9631",
        status: "active",
        createdAt: t(4200),
        lastAccessAt: t(120)
      },
      {
        id: "resident-3",
        name: "林志宏",
        unit: "C 棟 5F-03",
        phone: "0933-123-123",
        cardId: "CARD-C503",
        pin: "1470",
        status: "inactive",
        createdAt: t(3000),
        lastAccessAt: null
      }
    ],
    doors: [
      { id: "door-1", name: "A 棟大廳主入口", zone: "A 棟 / 1F", status: "locked", temporaryUnlockUntil: null, lastActionAt: t(40), lastActionBy: "中控室管理員", isOnline: true },
      { id: "door-2", name: "A 棟電梯廳", zone: "A 棟 / 1F", status: "locked", temporaryUnlockUntil: null, lastActionAt: t(55), lastActionBy: "中控室管理員", isOnline: true },
      { id: "door-3", name: "B 棟大廳主入口", zone: "B 棟 / 1F", status: "unlocked", temporaryUnlockUntil: t(-8), lastActionAt: t(2), lastActionBy: "中控室管理員", isOnline: true },
      { id: "door-4", name: "B 棟停車場入口", zone: "B 棟 / B1", status: "locked", temporaryUnlockUntil: null, lastActionAt: t(88), lastActionBy: "中控室管理員", isOnline: true },
      { id: "door-5", name: "C 棟側門", zone: "C 棟 / 1F", status: "locked", temporaryUnlockUntil: null, lastActionAt: t(130), lastActionBy: "中控室管理員", isOnline: true },
      { id: "door-6", name: "物流收件區", zone: "中央大廳", status: "offline", temporaryUnlockUntil: null, lastActionAt: t(360), lastActionBy: "系統", isOnline: false }
    ],
    visitors: [
      {
        id: "visitor-1",
        name: "李俊豪",
        idNo: "F123456789",
        hostUnit: "B 棟 12F-01",
        visitWindow: "14:00-16:00",
        purpose: "家電維修",
        passCode: "781245",
        status: "approved",
        createdAt: t(90),
        approvedAt: t(82),
        checkInAt: null,
        checkOutAt: null
      }
    ],
    logs: [
      {
        id: "log-1",
        timestamp: t(90),
        type: "visitor",
        target: "李俊豪 / B 棟 12F-01",
        action: "訪客申請核准",
        operator: "中控室管理員",
        note: "通行碼 781245"
      },
      {
        id: "log-2",
        timestamp: t(40),
        type: "door",
        target: "A 棟大廳主入口",
        action: "門禁鎖定",
        operator: "中控室管理員",
        note: "夜間模式"
      }
    ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedState();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return seedState();
    }
    return {
      ...seedState(),
      ...parsed
    };
  } catch (error) {
    return seedState();
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function shortDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function escapeHtml(text) {
  if (text === null || text === undefined) {
    return "";
  }
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function operatorName() {
  return state.operator && state.operator.trim() ? state.operator.trim() : "值班人員";
}

function appendLog(type, target, action, note = "") {
  state.logs.unshift({
    id: uid("log"),
    timestamp: new Date().toISOString(),
    type,
    target,
    action,
    operator: operatorName(),
    note
  });

  if (state.logs.length > 1200) {
    state.logs.length = 1200;
  }
}

function normalizeDoorStatus(door) {
  if (!door.isOnline) {
    door.status = "offline";
    door.temporaryUnlockUntil = null;
    return;
  }

  if (door.status === "offline") {
    door.status = "locked";
  }

  if (door.temporaryUnlockUntil) {
    const until = new Date(door.temporaryUnlockUntil).getTime();
    if (!Number.isNaN(until) && Date.now() >= until && door.status === "unlocked") {
      door.status = "locked";
      door.temporaryUnlockUntil = null;
      door.lastActionAt = new Date().toISOString();
      door.lastActionBy = "系統自動回鎖";
      appendLog("door", door.name, "限時解鎖到期自動回鎖", "系統排程");
    }
  }
}

function syncDoorState() {
  state.doors.forEach((door) => normalizeDoorStatus(door));
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function badgeClassForDoor(status) {
  if (status === "locked") {
    return "locked";
  }
  if (status === "unlocked") {
    return "unlocked";
  }
  return "offline";
}

function badgeClassForResident(status) {
  return status === "active" ? "active" : "inactive";
}

function badgeClassForVisitor(status) {
  if (status === "pending") {
    return "pending";
  }
  if (status === "approved") {
    return "approved";
  }
  if (status === "checked_in") {
    return "checked_in";
  }
  if (status === "checked_out") {
    return "checked_out";
  }
  return "rejected";
}
function commonInit() {
  syncDoorState();

  const page = document.body.dataset.page || "";
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === page) {
      link.classList.add("active");
    }
  });

  document.querySelectorAll("#operatorLabel").forEach((el) => {
    el.textContent = operatorName();
  });

  const clockEl = document.getElementById("liveClock");
  if (clockEl) {
    const tick = () => {
      clockEl.textContent = new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "medium",
        timeStyle: "medium"
      }).format(new Date());
    };
    tick();
    setInterval(tick, 1000);
  }

  saveState();
}

function doorStatusText(door) {
  if (!door.isOnline || door.status === "offline") {
    return statusText.door.offline;
  }
  return statusText.door[door.status] || "未知";
}

function renderDoorCard(door, options = {}) {
  const showLock = Boolean(options.showLock);
  const showUnlock = Boolean(options.showUnlock);
  const showRelock = Boolean(options.showRelock);
  const showDelete = Boolean(options.showDelete);

  const statusClass = badgeClassForDoor(door.status);
  const unlockUntil = door.temporaryUnlockUntil && door.status === "unlocked"
    ? `，至 ${formatDateTime(door.temporaryUnlockUntil)}`
    : "";

  return `
    <article class="door-card">
      <h4>${escapeHtml(door.name)}</h4>
      <p>${escapeHtml(door.zone)}</p>
      <div><span class="status ${statusClass}">${escapeHtml(doorStatusText(door))}</span></div>
      <p>最後操作：${escapeHtml(formatDateTime(door.lastActionAt))} / ${escapeHtml(door.lastActionBy || "-")}</p>
      <p>限時資訊：${unlockUntil ? escapeHtml(unlockUntil.slice(2)) : "-"}</p>
      <div class="inline-actions">
        ${showLock ? `<button type="button" data-action="lock" data-door-id="${escapeHtml(door.id)}" ${!door.isOnline || door.status === "locked" || state.emergencyMode ? "disabled" : ""}>鎖定</button>` : ""}
        ${showUnlock ? `<button type="button" data-action="unlock" data-door-id="${escapeHtml(door.id)}" ${!door.isOnline || state.emergencyMode ? "disabled" : ""}>解鎖</button>` : ""}
        ${showRelock ? `<button type="button" class="secondary" data-action="relock" data-door-id="${escapeHtml(door.id)}" ${!door.isOnline || door.status !== "unlocked" || state.emergencyMode ? "disabled" : ""}>回鎖</button>` : ""}
        ${showDelete ? `<button type="button" class="danger" data-action="delete-door" data-door-id="${escapeHtml(door.id)}">移除</button>` : ""}
      </div>
    </article>
  `;
}

function lockDoor(doorId, reason = "") {
  const door = state.doors.find((item) => item.id === doorId);
  if (!door || !door.isOnline || door.status === "locked" || state.emergencyMode) {
    return false;
  }
  door.status = "locked";
  door.temporaryUnlockUntil = null;
  door.lastActionAt = new Date().toISOString();
  door.lastActionBy = operatorName();
  appendLog("door", door.name, "門禁鎖定", reason || "手動鎖定");
  return true;
}

function unlockDoor(doorId, reason = "", minutes = 0) {
  const door = state.doors.find((item) => item.id === doorId);
  if (!door || !door.isOnline || state.emergencyMode) {
    return false;
  }
  door.status = "unlocked";
  if (minutes > 0) {
    door.temporaryUnlockUntil = new Date(Date.now() + minutes * 60000).toISOString();
  } else {
    door.temporaryUnlockUntil = null;
  }
  door.lastActionAt = new Date().toISOString();
  door.lastActionBy = operatorName();
  appendLog("door", door.name, "門禁解鎖", reason || (minutes > 0 ? `限時 ${minutes} 分鐘` : "手動解鎖"));
  return true;
}

function renderLogRows(logs, bodyId) {
  const tbody = document.getElementById(bodyId);
  if (!tbody) {
    return;
  }

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty">沒有符合條件的紀錄。</div></td></tr>`;
    return;
  }

  tbody.innerHTML = logs
    .map(
      (log) => `
      <tr>
        <td>${escapeHtml(formatDateTime(log.timestamp))}</td>
        <td>${escapeHtml(log.type)}</td>
        <td>${escapeHtml(log.target)}</td>
        <td>${escapeHtml(log.action)}</td>
        <td>${escapeHtml(log.operator)}</td>
        <td>${escapeHtml(log.note || "-")}</td>
      </tr>
    `
    )
    .join("");
}

function initDashboardPage() {
  const emergencyBanner = document.getElementById("emergencyBanner");
  if (emergencyBanner) {
    emergencyBanner.hidden = !state.emergencyMode;
  }

  const residentsTotal = state.residents.length;
  const residentsActive = state.residents.filter((r) => r.status === "active").length;
  const doorsTotal = state.doors.length;
  const locked = state.doors.filter((d) => d.status === "locked").length;
  const pendingVisitors = state.visitors.filter((v) => v.status === "pending").length;
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const todayEvents = state.logs.filter((log) => {
    const ts = new Date(log.timestamp).getTime();
    return !Number.isNaN(ts) && ts >= dayAgo;
  }).length;

  setText("metricResidents", String(residentsTotal));
  setText("metricResidentsHint", `啟用中 ${residentsActive}`);
  setText("metricDoors", String(doorsTotal));
  setText("metricDoorsHint", `已鎖定 ${locked}`);
  setText("metricVisitors", String(state.visitors.length));
  setText("metricVisitorsHint", `待審核 ${pendingVisitors}`);
  setText("metricEvents", String(todayEvents));

  const doorGrid = document.getElementById("dashboardDoorGrid");
  if (doorGrid) {
    if (!state.doors.length) {
      doorGrid.innerHTML = '<div class="empty">尚未建立門點資料。</div>';
    } else {
      doorGrid.innerHTML = state.doors.map((door) => renderDoorCard(door)).join("");
    }
  }

  renderLogRows(state.logs.slice(0, 12), "recentLogsBody");
}
function initRegisterPage() {
  const form = document.getElementById("residentForm");
  const searchInput = document.getElementById("residentSearch");
  const tbody = document.getElementById("residentTableBody");

  const render = () => {
    if (!tbody) {
      return;
    }

    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const rows = state.residents.filter((resident) => {
      if (!keyword) {
        return true;
      }
      return (
        resident.name.toLowerCase().includes(keyword) ||
        resident.unit.toLowerCase().includes(keyword) ||
        resident.cardId.toLowerCase().includes(keyword)
      );
    });

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty">查無住戶資料。</div></td></tr>';
      return;
    }

    tbody.innerHTML = rows
      .map(
        (resident) => `
          <tr>
            <td>${escapeHtml(resident.name)}</td>
            <td>${escapeHtml(resident.unit)}</td>
            <td>${escapeHtml(resident.phone || "-")}</td>
            <td>${escapeHtml(resident.cardId)}</td>
            <td><span class="status ${badgeClassForResident(resident.status)}">${escapeHtml(statusText.resident[resident.status] || resident.status)}</span></td>
            <td>${escapeHtml(formatDateTime(resident.createdAt))}</td>
            <td>${escapeHtml(formatDateTime(resident.lastAccessAt))}</td>
            <td>
              <div class="inline-actions">
                <button type="button" class="secondary" data-action="toggle-resident" data-id="${escapeHtml(resident.id)}">${resident.status === "active" ? "停用" : "啟用"}</button>
                <button type="button" class="warn" data-action="touch-access" data-id="${escapeHtml(resident.id)}" ${resident.status === "inactive" ? "disabled" : ""}>模擬刷卡</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const unit = String(data.get("unit") || "").trim();
      const phone = String(data.get("phone") || "").trim();
      const cardId = String(data.get("cardId") || "").trim();
      const pin = String(data.get("pin") || "").trim();

      if (!name || !unit || !cardId) {
        alert("請填寫姓名、戶號與門卡編號。");
        return;
      }

      if (state.residents.some((r) => r.cardId.toLowerCase() === cardId.toLowerCase())) {
        alert("門卡編號重複，請確認後再新增。");
        return;
      }

      state.residents.unshift({
        id: uid("resident"),
        name,
        unit,
        phone,
        cardId,
        pin,
        status: "active",
        createdAt: new Date().toISOString(),
        lastAccessAt: null
      });

      appendLog("resident", `${name} / ${unit}`, "住戶登記", `卡號 ${cardId}`);
      saveState();
      form.reset();
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", render);
  }

  if (tbody) {
    tbody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const id = target.dataset.id;
      const action = target.dataset.action;
      if (!id || !action) {
        return;
      }

      const resident = state.residents.find((item) => item.id === id);
      if (!resident) {
        return;
      }

      if (action === "toggle-resident") {
        resident.status = resident.status === "active" ? "inactive" : "active";
        appendLog(
          "resident",
          `${resident.name} / ${resident.unit}`,
          resident.status === "active" ? "住戶權限啟用" : "住戶權限停用",
          `卡號 ${resident.cardId}`
        );
      }

      if (action === "touch-access" && resident.status === "active") {
        resident.lastAccessAt = new Date().toISOString();
        appendLog("resident", `${resident.name} / ${resident.unit}`, "住戶刷卡通行", `卡號 ${resident.cardId}`);
      }

      saveState();
      render();
    });
  }

  render();
}

function initLockPage() {
  const grid = document.getElementById("lockDoorGrid");
  const lockAllBtn = document.getElementById("lockAllBtn");
  const reasonInput = document.getElementById("lockReason");

  const render = () => {
    if (!grid) {
      return;
    }

    if (!state.doors.length) {
      grid.innerHTML = '<div class="empty">目前沒有門點資料。</div>';
      return;
    }

    grid.innerHTML = state.doors.map((door) => renderDoorCard(door, { showLock: true })).join("");
  };

  if (grid) {
    grid.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (target.dataset.action !== "lock") {
        return;
      }
      const doorId = target.dataset.doorId;
      if (!doorId) {
        return;
      }
      const reason = reasonInput ? reasonInput.value.trim() : "";
      const changed = lockDoor(doorId, reason);
      if (changed) {
        saveState();
        render();
      }
    });
  }

  if (lockAllBtn) {
    lockAllBtn.addEventListener("click", () => {
      if (state.emergencyMode) {
        alert("緊急模式啟用中，無法執行鎖定操作。");
        return;
      }
      const reason = reasonInput ? reasonInput.value.trim() : "";
      let changedCount = 0;
      state.doors.forEach((door) => {
        if (lockDoor(door.id, reason || "一鍵鎖定")) {
          changedCount += 1;
        }
      });
      if (changedCount > 0) {
        appendLog("system", "全部門點", "一鍵門禁鎖定", `共 ${changedCount} 門點`);
        saveState();
        render();
      }
    });
  }

  render();
}
function initUnlockPage() {
  const form = document.getElementById("unlockForm");
  const select = document.getElementById("unlockDoorSelect");
  const minutesInput = document.getElementById("unlockMinutes");
  const reasonInput = document.getElementById("unlockReason");
  const unlockAllTenBtn = document.getElementById("unlockAllTenBtn");
  const grid = document.getElementById("unlockedDoorGrid");

  const refillSelect = () => {
    if (!select) {
      return;
    }
    const onlineDoors = state.doors.filter((door) => door.isOnline);
    select.innerHTML = onlineDoors
      .map(
        (door) =>
          `<option value="${escapeHtml(door.id)}">${escapeHtml(door.name)}（${escapeHtml(doorStatusText(door))}）</option>`
      )
      .join("");
  };

  const render = () => {
    refillSelect();
    if (!grid) {
      return;
    }
    const unlockedDoors = state.doors.filter((door) => door.status === "unlocked");
    if (!unlockedDoors.length) {
      grid.innerHTML = '<div class="empty">目前沒有解鎖中的門點。</div>';
      return;
    }
    grid.innerHTML = unlockedDoors.map((door) => renderDoorCard(door, { showRelock: true })).join("");
  };

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const doorId = select ? select.value : "";
      const minutes = Number(minutesInput ? minutesInput.value : 0);
      const normalizedMinutes = Number.isFinite(minutes) ? Math.max(0, Math.min(720, Math.floor(minutes))) : 0;
      const reason = reasonInput ? reasonInput.value.trim() : "";
      if (!doorId) {
        alert("請先選擇門點。");
        return;
      }
      const changed = unlockDoor(doorId, reason, normalizedMinutes);
      if (changed) {
        saveState();
        render();
      }
    });
  }

  if (unlockAllTenBtn) {
    unlockAllTenBtn.addEventListener("click", () => {
      if (state.emergencyMode) {
        alert("緊急模式啟用中，門點已全數解鎖。");
        return;
      }
      let changedCount = 0;
      state.doors.forEach((door) => {
        if (unlockDoor(door.id, "全部解鎖 10 分鐘", 10)) {
          changedCount += 1;
        }
      });
      if (changedCount > 0) {
        appendLog("system", "全部門點", "一鍵限時解鎖", "10 分鐘");
        saveState();
        render();
      }
    });
  }

  if (grid) {
    grid.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (target.dataset.action !== "relock") {
        return;
      }
      const doorId = target.dataset.doorId;
      if (!doorId) {
        return;
      }
      const changed = lockDoor(doorId, "手動回鎖");
      if (changed) {
        saveState();
        render();
      }
    });
  }

  render();
}

function visitorActionButtons(visitor) {
  if (visitor.status === "pending") {
    return `
      <button type="button" data-action="approve" data-id="${escapeHtml(visitor.id)}">核准</button>
      <button type="button" class="danger" data-action="reject" data-id="${escapeHtml(visitor.id)}">拒絕</button>
    `;
  }

  if (visitor.status === "approved") {
    return `<button type="button" data-action="check-in" data-id="${escapeHtml(visitor.id)}">入場</button>`;
  }

  if (visitor.status === "checked_in") {
    return `<button type="button" class="secondary" data-action="check-out" data-id="${escapeHtml(visitor.id)}">離場</button>`;
  }

  return "<span class=\"muted\">無可用操作</span>";
}

function initVisitorsPage() {
  const form = document.getElementById("visitorForm");
  const tbody = document.getElementById("visitorTableBody");

  const render = () => {
    if (!tbody) {
      return;
    }
    if (!state.visitors.length) {
      tbody.innerHTML = '<tr><td colspan="9"><div class="empty">目前沒有訪客申請。</div></td></tr>';
      return;
    }

    tbody.innerHTML = state.visitors
      .map(
        (visitor) => `
          <tr>
            <td>${escapeHtml(formatDateTime(visitor.createdAt))}</td>
            <td>${escapeHtml(visitor.name)}</td>
            <td>${escapeHtml(visitor.idNo)}</td>
            <td>${escapeHtml(visitor.hostUnit)}</td>
            <td>${escapeHtml(visitor.visitWindow || "-")}</td>
            <td>${escapeHtml(visitor.purpose)}</td>
            <td>${escapeHtml(visitor.passCode || "-")}</td>
            <td><span class="status ${badgeClassForVisitor(visitor.status)}">${escapeHtml(statusText.visitor[visitor.status] || visitor.status)}</span></td>
            <td>
              <div class="inline-actions">
                ${visitorActionButtons(visitor)}
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const idNo = String(data.get("idNo") || "").trim();
      const hostUnit = String(data.get("hostUnit") || "").trim();
      const visitWindow = String(data.get("visitWindow") || "").trim();
      const purpose = String(data.get("purpose") || "").trim();

      if (!name || !idNo || !hostUnit || !purpose) {
        alert("請完整填寫訪客基本資料。");
        return;
      }

      state.visitors.unshift({
        id: uid("visitor"),
        name,
        idNo,
        hostUnit,
        visitWindow,
        purpose,
        passCode: String(Math.floor(100000 + Math.random() * 900000)),
        status: "pending",
        createdAt: new Date().toISOString(),
        approvedAt: null,
        checkInAt: null,
        checkOutAt: null
      });

      appendLog("visitor", `${name} / ${hostUnit}`, "訪客申請建立", purpose);
      saveState();
      form.reset();
      render();
    });
  }
  if (tbody) {
    tbody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      const id = target.dataset.id;
      const action = target.dataset.action;
      if (!id || !action) {
        return;
      }

      const visitor = state.visitors.find((item) => item.id === id);
      if (!visitor) {
        return;
      }

      if (action === "approve" && visitor.status === "pending") {
        visitor.status = "approved";
        visitor.approvedAt = new Date().toISOString();
        appendLog("visitor", `${visitor.name} / ${visitor.hostUnit}`, "訪客申請核准", `通行碼 ${visitor.passCode}`);
      }

      if (action === "reject" && visitor.status === "pending") {
        visitor.status = "rejected";
        appendLog("visitor", `${visitor.name} / ${visitor.hostUnit}`, "訪客申請拒絕", visitor.purpose);
      }

      if (action === "check-in" && visitor.status === "approved") {
        visitor.status = "checked_in";
        visitor.checkInAt = new Date().toISOString();
        appendLog("visitor", `${visitor.name} / ${visitor.hostUnit}`, "訪客入場", `通行碼 ${visitor.passCode}`);
      }

      if (action === "check-out" && visitor.status === "checked_in") {
        visitor.status = "checked_out";
        visitor.checkOutAt = new Date().toISOString();
        appendLog("visitor", `${visitor.name} / ${visitor.hostUnit}`, "訪客離場", "流程完成");
      }

      saveState();
      render();
    });
  }

  render();
}

function initLogsPage() {
  const typeFilter = document.getElementById("logTypeFilter");
  const dateFilter = document.getElementById("logDateFilter");
  const applyBtn = document.getElementById("applyLogFilterBtn");
  const clearBtn = document.getElementById("clearLogFilterBtn");
  const exportBtn = document.getElementById("exportLogsBtn");

  const getFilteredLogs = () => {
    const type = typeFilter ? typeFilter.value : "all";
    const date = dateFilter ? dateFilter.value : "";

    return state.logs.filter((log) => {
      if (type && type !== "all" && log.type !== type) {
        return false;
      }
      if (date) {
        return shortDate(log.timestamp) === date;
      }
      return true;
    });
  };

  const render = () => {
    const logs = getFilteredLogs();
    renderLogRows(logs, "logTableBody");
  };

  if (applyBtn) {
    applyBtn.addEventListener("click", render);
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (typeFilter) {
        typeFilter.value = "all";
      }
      if (dateFilter) {
        dateFilter.value = "";
      }
      render();
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const logs = getFilteredLogs();
      const filename = `access-logs-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
      downloadJson(filename, logs);
    });
  }

  render();
}

function initSettingsPage() {
  const settingsForm = document.getElementById("settingsForm");
  const operatorInput = document.getElementById("operatorName");
  const emergencySelect = document.getElementById("emergencyModeSelect");
  const addDoorForm = document.getElementById("addDoorForm");
  const tableBody = document.getElementById("settingsDoorTableBody");
  const exportDataBtn = document.getElementById("exportDataBtn");
  const resetDemoBtn = document.getElementById("resetDemoBtn");

  const renderDoors = () => {
    if (!tableBody) {
      return;
    }

    if (!state.doors.length) {
      tableBody.innerHTML = '<tr><td colspan="5"><div class="empty">目前沒有門點資料。</div></td></tr>';
      return;
    }

    tableBody.innerHTML = state.doors
      .map(
        (door) => `
          <tr>
            <td>${escapeHtml(door.name)}</td>
            <td>${escapeHtml(door.zone)}</td>
            <td><span class="status ${badgeClassForDoor(door.status)}">${escapeHtml(doorStatusText(door))}</span></td>
            <td>${escapeHtml(formatDateTime(door.lastActionAt))}</td>
            <td>
              <div class="inline-actions">
                <button type="button" class="secondary" data-action="toggle-online" data-id="${escapeHtml(door.id)}">${door.isOnline ? "設為離線" : "恢復上線"}</button>
                <button type="button" class="danger" data-action="remove-door" data-id="${escapeHtml(door.id)}">移除</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  if (operatorInput) {
    operatorInput.value = state.operator || "";
  }

  if (emergencySelect) {
    emergencySelect.value = state.emergencyMode ? "on" : "off";
  }
  if (settingsForm) {
    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextOperator = operatorInput ? operatorInput.value.trim() : "";
      const nextEmergency = emergencySelect ? emergencySelect.value === "on" : false;

      if (!nextOperator) {
        alert("請填入值班人員名稱。");
        return;
      }

      const emergencyChanged = nextEmergency !== state.emergencyMode;
      state.operator = nextOperator;
      state.emergencyMode = nextEmergency;

      if (emergencyChanged && nextEmergency) {
        state.doors.forEach((door) => {
          if (door.isOnline) {
            door.status = "unlocked";
            door.temporaryUnlockUntil = null;
            door.lastActionAt = new Date().toISOString();
            door.lastActionBy = `${operatorName()}（緊急模式）`;
          }
        });
        appendLog("system", "緊急模式", "緊急模式啟用", "全部線上門點自動解鎖");
      }

      if (emergencyChanged && !nextEmergency) {
        appendLog("system", "緊急模式", "緊急模式關閉", "恢復一般管制");
      }

      appendLog("system", "系統設定", "設定更新", `值班人員 ${nextOperator}`);
      saveState();
      document.querySelectorAll("#operatorLabel").forEach((el) => {
        el.textContent = operatorName();
      });
      renderDoors();
    });
  }

  if (addDoorForm) {
    addDoorForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(addDoorForm);
      const name = String(data.get("name") || "").trim();
      const zone = String(data.get("zone") || "").trim();
      if (!name || !zone) {
        alert("請填寫門點名稱與區域。");
        return;
      }

      state.doors.push({
        id: uid("door"),
        name,
        zone,
        status: "locked",
        temporaryUnlockUntil: null,
        lastActionAt: new Date().toISOString(),
        lastActionBy: operatorName(),
        isOnline: true
      });

      appendLog("door", name, "新增門點", zone);
      saveState();
      addDoorForm.reset();
      renderDoors();
    });
  }

  if (tableBody) {
    tableBody.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      const id = target.dataset.id;
      const action = target.dataset.action;
      if (!id || !action) {
        return;
      }

      const door = state.doors.find((item) => item.id === id);
      if (!door) {
        return;
      }

      if (action === "toggle-online") {
        door.isOnline = !door.isOnline;
        if (!door.isOnline) {
          door.status = "offline";
          door.temporaryUnlockUntil = null;
        } else {
          door.status = state.emergencyMode ? "unlocked" : "locked";
        }
        door.lastActionAt = new Date().toISOString();
        door.lastActionBy = operatorName();
        appendLog("door", door.name, door.isOnline ? "門點恢復上線" : "門點設為離線", door.zone);
      }

      if (action === "remove-door") {
        const ok = window.confirm(`確定要移除門點「${door.name}」嗎？`);
        if (!ok) {
          return;
        }
        state.doors = state.doors.filter((item) => item.id !== id);
        appendLog("door", door.name, "移除門點", door.zone);
      }

      saveState();
      renderDoors();
    });
  }

  if (exportDataBtn) {
    exportDataBtn.addEventListener("click", () => {
      const filename = `access-control-backup-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
      downloadJson(filename, state);
    });
  }

  if (resetDemoBtn) {
    resetDemoBtn.addEventListener("click", () => {
      const ok = window.confirm("確定要清空目前資料並重設為示範資料？");
      if (!ok) {
        return;
      }
      state = seedState();
      appendLog("system", "系統資料", "資料重設", "已還原為示範資料");
      saveState();
      if (operatorInput) {
        operatorInput.value = state.operator;
      }
      if (emergencySelect) {
        emergencySelect.value = state.emergencyMode ? "on" : "off";
      }
      document.querySelectorAll("#operatorLabel").forEach((el) => {
        el.textContent = operatorName();
      });
      renderDoors();
    });
  }

  renderDoors();
}

function initPage() {
  commonInit();
  const page = document.body.dataset.page;

  if (page === "dashboard") {
    initDashboardPage();
    return;
  }

  if (page === "register") {
    initRegisterPage();
    return;
  }

  if (page === "lock") {
    initLockPage();
    return;
  }

  if (page === "unlock") {
    initUnlockPage();
    return;
  }

  if (page === "visitors") {
    initVisitorsPage();
    return;
  }

  if (page === "logs") {
    initLogsPage();
    return;
  }

  if (page === "settings") {
    initSettingsPage();
  }
}

document.addEventListener("DOMContentLoaded", initPage);
