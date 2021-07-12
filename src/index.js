const { remote } = require("electron");
const childProcess = require("child_process");

function handleRunProject(id) {
  const project = listProject.find((el) => el.id === id);
  console.log({ project: project.screens });
  if (project) {
    let command = `wt.exe -M `;
    let arrRowSubCmd = [];
    let countEmptySubCommand = 0;
    // let command = `wt.exe -M cmd /k node -v; split-pane -V cmd /k node; split-pane -H cmd /k npm -v`;

    // get sub command column
    for (let i = 0; i < project.screens.length; i++) {
      const subCmd = project.screens[i][0].command.trim();
      command += subCmd ? `cmd /k "${subCmd}"; ` : "; ";
      if (i < project.screens.length - 1) {
        command += `split-pane -V `;
      }

      // get sub command from row 1 in every column
      let arrSubCmd = [];
      for (let j = 1; j < project.screens[i].length; j++) {
        const subCmd = project.screens[i][j].command.trim();
        if (subCmd) {
          arrSubCmd.push(`split-pane -H cmd /k "${subCmd}"; `);
        }
      }
      if (arrSubCmd.length > 0) countEmptySubCommand++;
      arrRowSubCmd.push([...arrSubCmd]);
    }

    if (arrRowSubCmd.length <= 0) {
      command.slice(0, command.length - 1);
    }
    console.log({ command, arrRowSubCmd, countEmptySubCommand });

    for (let i = arrRowSubCmd.length - 1; i >= 0; i--) {
      if (arrRowSubCmd[i].length > 0) countEmptySubCommand--;
      for (let j = 0; j < arrRowSubCmd[i].length; j++) {
        command += arrRowSubCmd[i][j];
      }
      if (i > 0 && countEmptySubCommand > 0) command += "move-focus left; ";
    }
    command = command.slice(0, command.length - 2);
    console.log({ command });

    childProcess.exec(command);
  }
}

// init db - pathDb:
const Store = require("electron-store");
const store = new Store();

// config var
const MAX_COLUMN = 3;
const MAX_ROW = 2;
const DEFAULT_PROJECT = {
  title: "",
  description: "",
  screens: [
    [
      {
        command: "",
      },
    ],
  ],
};

// init global variable
let searchKey = "";
let currentProject = {};
let listProject = [];

// clone object,...
function cloneObject(obj) {
  const newObj = JSON.parse(JSON.stringify(obj));
  return newObj;
}

// notification
async function handleNotification({
  type = "error",
  title = "Error",
  buttons,
  message = "Lỗi hệ thống",
}) {
  const options = {
    type,
    title,
    buttons,
    message,
  };
  const status = await remote.dialog.showMessageBox(null, options);
  return status.response;
}

function handleCloseModalDetail() {
  const modalDetail = document.getElementById("modal-detail");
  modalDetail.className = "modal";
}

function handleDeleteProject(id) {
  const indexDel = listProject.findIndex((el) => el.id === id);
  newListProject = [...listProject];
  newListProject.splice(indexDel, 1);
  listProject = [...newListProject];
  renderList();
  handleSaveProjectDataToDb(listProject);
}

// validate project before update
function validateProjectInformation(obj) {
  const title = (obj.title && obj.title.trim()) || null;
  if (!title) {
    handleNotification({
      type: "error",
      message: "Title can't empty",
    });
    return false;
  }

  const findSameTitle = listProject.find(
    (el) => el.title === title && el.id !== currentProject.id
  );
  if (findSameTitle) {
    handleNotification({
      type: "error",
      message: "Title is exist",
    });
    return false;
  }

  return true;
}

// save project to db
function handleSaveProjectDataToDb(value) {
  if (value) {
    const newListProject = cloneObject(value);
    store.set("projects", newListProject);
  }
}

// handle save project
function handleSaveProject() {
  if (!validateProjectInformation(currentProject)) {
    return;
  }
  const projectUpdate = cloneObject(currentProject);
  console.log(projectUpdate);
  if (projectUpdate.id) {
    const pos = listProject.findIndex((el) => el.id === projectUpdate.id);
    listProject[pos] = projectUpdate;
  } else {
    projectUpdate.id = listProject.length + 1;
    listProject = [projectUpdate, ...listProject];
  }

  renderList();
  currentProject = cloneObject(DEFAULT_PROJECT);
  handleCloseModalDetail();
  handleSaveProjectDataToDb(listProject);
}

// handle cancel update project
function handleCancelEditProject() {
  currentProject = cloneObject(DEFAULT_PROJECT);
  handleCloseModalDetail();
}

// render textarea html
function renderTextarea({
  rows = 5,
  id,
  placeholder = "Textarea",
  defaultValue,
}) {
  const textarea = document.createElement("textarea");
  textarea.setAttribute("placeholder", placeholder);
  textarea.setAttribute("rows", rows);
  textarea.setAttribute("id", id);
  textarea.className = "textarea";
  textarea.value = defaultValue || "";
  return textarea;
}

// render input html
function renderInput({
  id,
  placeholder = "input",
  type = "text",
  defaultValue,
}) {
  const input = document.createElement("input");
  input.setAttribute("placeholder", placeholder);
  input.setAttribute("type", type);
  if (id) {
    input.setAttribute("id", id);
  }
  input.className = "input";
  input.value = defaultValue || "";
  return input;
}

// render form html
function renderComponentForm({ children, type = "col", id }) {
  const field = document.createElement("div");
  field.className = "field";

  const control = document.createElement("div");
  control.className = "control";

  control.appendChild(children);
  field.appendChild(control);
  if (type === "col") {
    const col = document.createElement("div");
    col.className = "column";
    col.setAttribute("id", id);
    col.appendChild(field);
    return col;
  } else {
    field.setAttribute("id", id);
  }
  return field;
}

function renderRowInColumn({ height, row, col, command }) {
  const textarea = renderTextarea({
    rows: height || 4,
    id: `col-content-input-${col}-${row}`,
    defaultValue: command || "",
  });
  textarea.addEventListener("change", (e) => {
    const { value } = e.target;
    currentProject.screens[col][row].command = value;
  });
  const textareaContainer = renderComponentForm({
    children: textarea,
    id: `col-content-${col}-${row}`,
    type: "row",
  });
  return textareaContainer;
}

function renderByMaxColumn({ screens }) {
  const listColConfig = document.getElementById("list-column-config");
  const listColContent = document.getElementById("list-column-content");

  listColConfig.innerHTML = "";
  listColContent.innerHTML = "";

  for (let i = 0; i < screens.length; i++) {
    const input = renderInput({
      id: `col-config-input-${i}`,
      defaultValue: screens[i].length || 1,
    });
    input.addEventListener("change", (e) => {
      const { value } = e.target;
      let rowLimit = parseInt(value) || 1;
      if (!validateRow(rowLimit)) {
        input.value = 1;
        rowLimit = 1;
      }
      const colContent = document.getElementById(`col-content-${i}`);
      colContent.innerHTML = "";
      const newScreensCol = [];
      for (let row = 0; row < rowLimit; row++) {
        newScreensCol.push({ command: "" });
        textareaContainer = renderRowInColumn({
          row,
          col: i,
          command: "",
        });
        colContent.appendChild(textareaContainer);
      }
      currentProject.screens[i] = [...newScreensCol];
    });

    const colConfig = renderComponentForm({
      children: input,
      id: `col-config-${i}`,
    });
    listColConfig.appendChild(colConfig);

    const colContent = document.createElement("div");
    colContent.className = "column";
    colContent.setAttribute("id", `col-content-${i}`);
    for (let row = 0; row < screens[i].length; row++) {
      const textareaContainer = renderRowInColumn({
        col: i,
        row,
        command: screens[i][row].command,
      });
      colContent.appendChild(textareaContainer);
    }
    listColContent.appendChild(colContent);
  }
}

// validate number of column
function validateColumn(value) {
  if (typeof value !== "number" || value <= 0 || value > MAX_COLUMN) {
    handleNotification({
      type: "error",
      message: "Max Column must a number and has value from 1 to 3",
    });
    return false;
  }

  return true;
}

// validate number of row
function validateRow(value) {
  if (typeof value !== "number" || value <= 0 || value > MAX_ROW) {
    handleNotification({
      type: "error",
      message: "Max Row must a number and has value from 1 to 2",
    });
    return false;
  }

  return true;
}

// handle change max column
const maxCol = document.getElementById("max-column-input");
maxCol.addEventListener("change", (e) => {
  let value = parseInt(e.target.value);
  if (!validateColumn(value)) {
    maxCol.value = 1;
    value = 1;
  }

  let newScreens = [];
  for (let i = 0; i < value; i++) {
    newScreens.push([{ command: "" }]);
  }
  currentProject.screens = [...newScreens];
  renderByMaxColumn({ screens: currentProject.screens });
});

// handle change title
const titleInput = document.getElementById("modal-title-input");
const desInput = document.getElementById("modal-description-input");

titleInput.addEventListener("change", (e) => {
  const { value } = e.target;
  currentProject.title = value;
});

desInput.addEventListener("change", (e) => {
  const { value } = e.target;
  currentProject.description = value;
});

// handle open modal - if exist id when click project item - click btn add
function handleOpenModalDetail(id) {
  const modalDetail = document.getElementById("modal-detail");
  const maxCol = document.getElementById("max-column-input");
  modalDetail.className = "modal is-active";
  if (id) {
    const selectProject = listProject.find((el) => el.id === id);
    if (selectProject) {
      currentProject = cloneObject(selectProject);
      const modalTitleInput = document.getElementById("modal-title-input");
      const modalDesInput = document.getElementById("modal-description-input");
      modalTitleInput.value = selectProject.title;
      modalDesInput.value = selectProject.description;
      maxCol.value = selectProject.screens.length;
      renderByMaxColumn({ screens: [...currentProject.screens] });
      return;
    }
  }
  const modalTitleInput = document.getElementById("modal-title-input");
  const modalDesInput = document.getElementById("modal-description-input");
  maxCol.value = "1";
  modalTitleInput.value = "";
  modalDesInput.value = "";
  currentProject = cloneObject(DEFAULT_PROJECT);
  renderByMaxColumn({ screens: [...currentProject.screens] });
}

// handle event when click add project
const btnAdd = document.getElementById("btn-add");
btnAdd.addEventListener("click", () => {
  handleOpenModalDetail();
});

// render list project
function renderList() {
  const listItemDom = document.getElementById("list-item");
  listItemDom.innerHTML = "";
  listProject
    .filter((el) => el.title.indexOf(searchKey) >= 0)

    .forEach((el) => {
      const row = document.createElement("a");
      row.className =
        "panel-block is-active field is-grouped is-justify-content-space-between is-align-items-center";
      // handle event click row
      row.addEventListener("click", () => {
        handleOpenModalDetail(el.id);
      });
      // content
      const contentCol = document.createElement("div");
      contentCol.className = "field is-grouped is-align-items-center";

      const iconBox = document.createElement("span");
      iconBox.className = "panel-icon";

      const icon = document.createElement("i");
      icon.className = "fas fa-book";
      icon.setAttribute("aria-hidden", "true");

      iconBox.appendChild(icon);

      const title = document.createElement("div");
      title.textContent = el.title;

      contentCol.appendChild(iconBox);
      contentCol.appendChild(title);

      // action
      const actionCol = document.createElement("div");
      actionCol.className = "field is-grouped is-align-items-center";

      const btnBoxRun = document.createElement("p");
      btnBoxRun.className = "control";
      const btnRun = document.createElement("button");
      btnRun.className = "button is-success is-outlined";
      btnRun.innerHTML = `<span class="icon is-small">
        <i class="fas fa-play"></i>
      </span><span>Run</span>`;
      btnRun.setAttribute("id", `btnRun-${el.id}`);

      // handle event click run
      btnRun.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleRunProject(el.id);
      });
      btnBoxRun.appendChild(btnRun);

      const btnBoxDelete = document.createElement("p");
      btnBoxDelete.className = "control";
      const btnDelete = document.createElement("button");
      btnDelete.className = "button is-danger is-outlined";
      btnDelete.innerHTML = `<span class="icon is-small">
          <i class="fas fa-trash"></i>
        </span><span>Delete</span>`;

      // handle event click delete
      btnDelete.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isConfirm = await handleNotification({
          type: "question",
          title: "Notification",
          buttons: ["No", "Yes"],
          message: `Do you want to delete ${el.title}?`,
        });
        if (isConfirm) {
          handleDeleteProject(el.id);
        }
      });
      btnBoxDelete.appendChild(btnDelete);

      actionCol.appendChild(btnBoxRun);
      actionCol.appendChild(btnBoxDelete);

      // add content, action to row
      row.appendChild(contentCol);
      row.appendChild(actionCol);

      listItemDom.appendChild(row);
    });
}
// handle search
function handleSearch(key) {
  searchKey = key;
  renderList();
}

// detect change input search
const inputSearch = document.getElementById("input-search");
inputSearch.addEventListener("change", (e) => {
  const { value } = e.target;
  handleSearch(value);
});

// run
async function run() {
  const projects = store.get("projects");
  if (projects) {
    listProject = cloneObject(projects);
  } else {
    store.set("projects", []);
  }
  renderList();
  const maxColLabel = document.getElementById("max-column-label");
  maxColLabel.textContent = `Column (Max: ${MAX_COLUMN})`;
}

// call run()
run();
