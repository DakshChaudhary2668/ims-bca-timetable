"use strict";

const $ = (id) => document.getElementById(id);
const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const versionLabels = {
  DRAFT: "Draft",
  VALIDATED: "Validated",
  PUBLISHED: "Published",
};
const keyName = "ims-operator-key";
let token = sessionStorage.getItem(keyName) ?? "";
let operator = null;
let result = null;
let mode = "section";
let daily = false;
let weekday = String(((new Date().getDay() + 6) % 7) + 1);
let sequence = 0;
let fieldId = 0;
let working = false;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function setOptions(select, records, label, placeholder) {
  const previous = select.value;
  select.replaceChildren();
  if (placeholder || !records.length)
    select.add(new Option(placeholder || "None configured", ""));
  for (const record of records)
    select.add(new Option(label(record), record.id));
  if (records.some(({ id }) => id === previous)) select.value = previous;
  select.disabled = records.length === 0;
}

function field(label, input) {
  const wrapper = node("div", undefined, "field");
  const caption = node("label", label);
  input.id = `timetable-field-${++fieldId}`;
  caption.htmlFor = input.id;
  wrapper.append(caption, input);
  return wrapper;
}

async function api(path, body, credential = token) {
  const headers = credential ? { authorization: `Bearer ${credential}` } : {};
  if (body) headers["content-type"] = "application/json";
  const response = await fetch(`/api/${path}`, {
    headers,
    cache: "no-store",
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(
      payload.error?.message || "The request could not be completed.",
    );
    error.status = response.status;
    error.issues = payload.error?.issues ?? [];
    throw error;
  }
  return payload;
}

function feedback(message, issues = []) {
  $("operationMessage").textContent = message;
  $("issues").replaceChildren(
    ...issues.map(({ message }) => node("li", message)),
  );
}

function showMessage(message) {
  $("scheduleMessage").textContent = message;
  $("scheduleMessage").hidden = !message;
}

async function load(versionId) {
  const current = ++sequence;
  const year = $("year").value;
  result = null;
  $("scheduleTable").hidden = true;
  $("dailySchedule").hidden = true;
  $("week").disabled = true;
  renderActions();
  $("publishStatus").textContent = "Loading…";
  showMessage("Loading timetable…");
  try {
    if (!year) {
      showMessage(
        "No academic years are configured. Add one in Academic setup.",
      );
      $("publishStatus").textContent = "No academic year";
      return;
    }
    const query = versionId
      ? `?versionId=${encodeURIComponent(versionId)}`
      : "";
    const next = await api(`timetables/${year}${query}`);
    if (current !== sequence) return;
    result = next;
    setOptions($("week"), result.versions, (version) =>
      version.status === "PUBLISHED"
        ? `Published v${version.number}`
        : `${versionLabels[version.status]} · revision ${version.revision}`,
    );
    $("week").value = result.version?.id ?? "";
    render();
  } catch (error) {
    if (current !== sequence) return;
    showMessage(`${error.message} Use Reload to try again.`);
    $("publishStatus").textContent = "Unavailable";
  }
}

function renderOperator() {
  const button = $("operatorButton");
  button.textContent = operator ? "Sign out" : "Operator sign in";
  button.setAttribute(
    "aria-label",
    operator ? `Sign out · ${operator.id}` : "Operator sign in",
  );
}

async function start() {
  if (token) {
    try {
      operator = await api("operator");
    } catch (error) {
      if (error.status !== 401) {
        showMessage("Could not check your session. Use Reload to try again.");
        $("publishStatus").textContent = "Unavailable";
        return;
      }
      operator = null;
      token = "";
      sessionStorage.removeItem(keyName);
    }
  }
  renderOperator();
  try {
    const years = await api("academic-years");
    years.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
    setOptions($("year"), years, (year) => year.name);
    await load();
  } catch (error) {
    showMessage(
      `Could not load academic records. ${error.message} Use Reload to try again.`,
    );
    $("publishStatus").textContent = "Unavailable";
  }
}

const editable = () =>
  operator && result?.version && result.version.status !== "PUBLISHED";
const time = (minute) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const period = (slot) =>
  `${time(slot.startsAtMinute)}–${time(slot.endsAtMinute)}`;
const semester = () =>
  result?.display.semesters.find(({ id }) => id === $("programme").value);

function renderActions() {
  const status = result?.version?.status;
  const button = $("generateButton");
  const draftExists = result?.versions.some(
    (version) => version.status !== "PUBLISHED",
  );
  const creating = !draftExists && (!status || status === "PUBLISHED");
  button.textContent = creating ? "Create draft" : "Publish";
  button.disabled =
    working ||
    !result ||
    !operator ||
    (!creating && (status !== "VALIDATED" || !operator.publish));
  button.title = !operator
    ? "Sign in to edit"
    : creating
      ? ""
      : !operator.publish
        ? "Publishing permission required"
        : "Validate the draft before publishing";
  $("validateButton").disabled = working || !editable();
  $("printButton").disabled =
    !result?.version || result.display.entries.length === 0;
  $("year").disabled = working || $("year").options[0]?.value === "";
  $("week").disabled = working || !result?.versions.length;
  $("operatorButton").disabled = working;
  $("reloadButton").disabled = working;
}

function render() {
  if (!result) return;
  const { display, version } = result;
  setOptions(
    $("programme"),
    display.semesters,
    (row) => `BCA · Semester ${row.number}`,
  );
  const scopes =
    mode === "section"
      ? (semester()?.sections ?? [])
      : mode === "faculty"
        ? [
            ...new Map(
              display.allocations
                .filter((row) => row.semesterId === semester()?.id)
                .map(({ faculty }) => [faculty.id, faculty]),
            ).values(),
          ].sort((a, b) => a.name.localeCompare(b.name))
        : display.rooms;
  $("scopeLabel").textContent = {
    section: "Section",
    faculty: "Faculty",
    room: "Room",
  }[mode];
  setOptions($("section"), scopes, (row) =>
    mode === "section" ? `Section ${row.name}` : row.name,
  );
  $("publishStatus").textContent = version
    ? versionLabels[version.status]
    : "No published timetable";
  $("publishStatus").classList.toggle(
    "published",
    version?.status === "PUBLISHED",
  );
  $("versionDetails").textContent =
    version?.status === "PUBLISHED"
      ? `Version ${version.number} · ${version.publishedBy} · ${new Date(version.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
      : version
        ? `Revision ${version.revision} · ${display.entries.length} sessions across this academic year`
        : "No timetable version selected.";
  renderActions();
  renderSchedule();
}

function renderSchedule() {
  const selected = $("section").selectedOptions[0]?.textContent;
  $("printMeta").textContent = [
    $("year").selectedOptions[0]?.textContent,
    semester() && `Semester ${semester().number}`,
    selected,
    $("versionDetails").textContent,
  ]
    .filter(Boolean)
    .join(" · ");
  const table = $("scheduleTable");
  const dailyPanel = $("dailySchedule");
  table.hidden = true;
  dailyPanel.hidden = true;
  if (!result) return;
  const { slots, allocations, entries, rooms } = result.display;
  const section = $("section").value;
  if (!semester() || !slots.length || !section) {
    showMessage(
      "Configure semesters, sections and time slots in Academic setup to use this timetable view.",
    );
    return;
  }
  if (!result.version) {
    showMessage(
      operator
        ? "Create a draft to start scheduling."
        : "No timetable has been published for this academic year.",
    );
    return;
  }
  showMessage("");
  const allocationMap = new Map(
    allocations.map((allocation) => [allocation.id, allocation]),
  );
  const roomMap = new Map(rooms.map((room) => [room.id, room.name]));
  const visible = entries.filter((entry) => {
    const allocation = allocationMap.get(entry.allocationId);
    return (
      allocation?.semesterId === semester().id &&
      (mode === "section"
        ? allocation.studentGroup.sectionId === section
        : mode === "faculty"
          ? allocation.facultyId === section
          : entry.roomId === section)
    );
  });
  const sessionLabel = (entry) => {
    const allocation = allocationMap.get(entry.allocationId);
    return `${allocation.faculty.name} · ${allocation.studentGroup.name} · ${roomMap.get(entry.roomId) ?? "Room unavailable"}`;
  };

  if (daily) {
    dailyPanel.hidden = false;
    const select = node("select");
    const days = [...new Set(slots.map((slot) => slot.weekday))].map((day) => ({
      id: String(day),
      name: weekdays[day - 1],
    }));
    select.value = weekday;
    setOptions(select, days, ({ name }) => name);
    if (days.some(({ id }) => id === weekday)) select.value = weekday;
    select.addEventListener("change", () => {
      weekday = select.value;
      renderSchedule();
      dailyPanel.querySelector("select").focus();
    });
    dailyPanel.replaceChildren(field("Weekday", select));
    for (const slot of slots.filter(
      (row) => String(row.weekday) === select.value,
    )) {
      for (const entry of visible.filter((row) => row.timeSlotId === slot.id)) {
        const item = node("article");
        item.append(
          node("strong", allocationMap.get(entry.allocationId).subject.name),
          node("p", `${period(slot)} · ${sessionLabel(entry)}`),
        );
        dailyPanel.append(item);
      }
    }
    if (!dailyPanel.querySelector("article"))
      dailyPanel.append(node("p", "No sessions scheduled for this day."));
    return;
  }

  table.hidden = false;
  const columns = [
    ...new Map(slots.map((slot) => [period(slot), slot])).values(),
  ].sort(
    (a, b) =>
      a.startsAtMinute - b.startsAtMinute || a.endsAtMinute - b.endsAtMinute,
  );
  const header = node("tr");
  for (const label of ["Day", ...columns.map(period)]) {
    const heading = node("th", label);
    heading.scope = "col";
    header.append(heading);
  }
  table.tHead.replaceChildren(header);
  table.tBodies[0].replaceChildren();
  for (const day of new Set(slots.map(({ weekday }) => weekday))) {
    const row = node("tr");
    const heading = node("th", weekdays[day - 1]);
    heading.scope = "row";
    row.append(heading);
    for (const column of columns) {
      const cell = node("td");
      row.append(cell);
      const slot = slots.find(
        (entry) => entry.weekday === day && period(entry) === period(column),
      );
      if (!slot) {
        cell.textContent = "—";
        continue;
      }
      if (slot.protectedBreak) {
        cell.className = "protected-cell";
        cell.textContent = "Break";
        continue;
      }
      const scheduled = visible.filter((entry) => entry.timeSlotId === slot.id);
      for (const entry of scheduled) {
        const canEdit = editable() && mode === "section";
        const card = node(
          canEdit ? "button" : "div",
          allocationMap.get(entry.allocationId).subject.code,
          "course-card lecture",
        );
        card.append(node("small", sessionLabel(entry)));
        if (canEdit) {
          card.type = "button";
          card.addEventListener("click", () => edit(slot, entry));
        }
        cell.append(card);
      }
      if (editable() && mode === "section") {
        const add = node("button", "+ Add", "course-card empty");
        add.type = "button";
        add.setAttribute(
          "aria-label",
          `Add session, ${weekdays[day - 1]} ${period(slot)}`,
        );
        add.addEventListener("click", () => edit(slot));
        cell.append(add);
      } else if (!scheduled.length) cell.textContent = "—";
    }
    table.tBodies[0].append(row);
  }
}

function dialog(title, content, action, onSubmit) {
  const modal = $("modal");
  const heading = node("h2", title, "modal-title");
  heading.id = "modalTitle";
  const error = node("p");
  error.id = "modalError";
  error.setAttribute("role", "alert");
  $("modalContent").replaceChildren(heading, ...content, error);
  const submit = $("modalAction");
  submit.textContent = action;
  const form = modal.querySelector("form");
  form.onsubmit = async (event) => {
    if (
      event.submitter?.value === "cancel" ||
      event.submitter?.classList.contains("modal-close")
    ) {
      event.preventDefault();
      if (!working && !submit.disabled) modal.close();
      return;
    }
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    error.textContent = "";
    try {
      await onSubmit();
      modal.close();
    } catch (failure) {
      error.textContent = [
        failure.message,
        ...(failure.issues ?? []).map((issue) => issue.message),
      ].join(" ");
    } finally {
      submit.disabled = false;
    }
  };
  modal.oncancel = (event) => {
    if (submit.disabled || working) event.preventDefault();
  };
  modal.showModal();
}

async function change(action, fields = {}) {
  if (working || !result) return;
  const year = $("year").value;
  const version = result.version;
  working = true;
  renderActions();
  try {
    await api(`timetables/${year}`, {
      action,
      ...(action === "create"
        ? {}
        : { versionId: version.id, revision: version.revision }),
      ...fields,
    });
    feedback(
      {
        create: "Draft created on the server.",
        save: "Session saved.",
        remove: "Session removed.",
        validate: "This revision passed validation.",
        publish: "Published version saved.",
      }[action],
    );
    await load();
  } catch (error) {
    feedback(error.message, error.issues);
    throw error;
  } finally {
    working = false;
    renderActions();
  }
}

function edit(slot, entry) {
  if (!editable() || working) return;
  const allocation = node("select");
  const room = node("select");
  const choices = result.display.allocations.filter(
    (row) =>
      row.studentGroup.sectionId === $("section").value && row.faculty.active,
  );
  setOptions(
    allocation,
    choices,
    (row) =>
      `${row.subject.code} · ${row.faculty.name} · ${row.studentGroup.name}`,
    "Choose allocation",
  );
  setOptions(room, result.display.rooms, (row) => row.name, "Choose room");
  allocation.value = entry?.allocationId ?? "";
  room.value = entry?.roomId ?? "";
  allocation.required = true;
  room.required = true;
  const content = [
    node("p", `${weekdays[slot.weekday - 1]} · ${period(slot)}`),
    field("Teaching allocation", allocation),
    field("Room", room),
  ];
  if (!choices.length || !result.display.rooms.length)
    content.push(
      node(
        "p",
        "Configure a teaching allocation and room in academic records first.",
      ),
    );
  if (entry) {
    const remove = node("button", "Remove session", "outline-button");
    remove.type = "button";
    remove.addEventListener("click", () => {
      $("modal").close();
      dialog(
        "Remove session?",
        [node("p", "This removes the session from the working draft.")],
        "Remove session",
        () => change("remove", { entryId: entry.id }),
      );
    });
    content.push(remove);
  }
  dialog(
    entry ? "Edit session" : "Add session",
    content,
    "Save session",
    () => {
      if (!allocation.value || !room.value)
        throw new Error("Choose a teaching allocation and room.");
      return change("save", {
        ...(entry ? { entryId: entry.id } : {}),
        placement: {
          allocationId: allocation.value,
          timeSlotId: slot.id,
          roomId: room.value,
        },
      });
    },
  );
}

$("operatorButton").addEventListener("click", () => {
  if (operator) {
    sessionStorage.removeItem(keyName);
    token = "";
    operator = null;
    renderOperator();
    feedback("Signed out. Server drafts remain saved.");
    void load();
    return;
  }
  const input = node("input");
  input.type = "password";
  input.required = true;
  input.autocomplete = "off";
  dialog(
    "Operator sign in",
    [field("Operator key", input)],
    "Sign in",
    async () => {
      const value = input.value.trim();
      if (!value) throw new Error("Enter your operator key.");
      const identity = await api("operator", undefined, value);
      sessionStorage.setItem(keyName, value);
      token = value;
      operator = identity;
      renderOperator();
      feedback("Signed in. You can now work on shared drafts.");
      await load();
    },
  );
});

$("menuButton").addEventListener("click", () => {
  $("menuButton").setAttribute(
    "aria-expanded",
    String($("sidebar").classList.toggle("open")),
  );
});
$("dailyButton").addEventListener("click", () => {
  daily = !daily;
  $("dailyButton").setAttribute("aria-pressed", String(daily));
  $("pageTitle").textContent = daily ? "Daily timetable" : "Weekly timetable";
  $("sidebar").classList.remove("open");
  $("menuButton").setAttribute("aria-expanded", "false");
  $("pageTitle").tabIndex = -1;
  $("pageTitle").focus();
  renderSchedule();
});
for (const tab of document.querySelectorAll("[data-view]")) {
  tab.setAttribute("aria-pressed", String(tab.dataset.view === mode));
  tab.addEventListener("click", () => {
    mode = tab.dataset.view;
    for (const option of document.querySelectorAll("[data-view]")) {
      option.classList.toggle("selected", option === tab);
      option.setAttribute("aria-pressed", String(option === tab));
    }
    render();
  });
}

$("year").addEventListener("change", () => {
  feedback("Validation checks run on the server.");
  void load();
});
$("week").addEventListener("change", () => {
  feedback("Validation checks run on the server.");
  void load($("week").value);
});
$("programme").addEventListener("change", render);
$("section").addEventListener("change", renderSchedule);
$("reloadButton").addEventListener("click", () => {
  feedback("Reloading current records…");
  void start();
});
$("validateButton").addEventListener("click", () => {
  void change("validate").catch(() => {});
});
$("generateButton").addEventListener("click", () => {
  if (result.version?.status === "VALIDATED") {
    dialog(
      "Publish this timetable?",
      [
        node(
          "p",
          "Publishing locks this revision and preserves previous versions.",
        ),
      ],
      "Publish version",
      () => change("publish"),
    );
  } else void change("create").catch(() => {});
});
$("printButton").addEventListener("click", () => window.print());

const legacy = localStorage.getItem("ims-academic-scheduling:v1");
if (legacy) {
  $("legacyButton").hidden = false;
  $("legacyButton").addEventListener("click", () => {
    try {
      const backup = JSON.stringify(
        {
          app: "ims-academic-scheduling",
          exportedAt: new Date().toISOString(),
          data: JSON.parse(legacy),
        },
        null,
        2,
      );
      const link = node("a");
      link.href = URL.createObjectURL(
        new Blob([backup], { type: "application/json" }),
      );
      link.download = "ims-timetable-browser-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch {
      feedback(
        "The previous browser data could not be exported as a supported backup. It has been left untouched.",
      );
    }
  });
}
void start();
