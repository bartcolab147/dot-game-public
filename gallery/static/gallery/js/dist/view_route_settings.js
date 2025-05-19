"use strict";
// view_route_settings.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class BoardSettingsManager {
    constructor(context) {
        this.boardId = null;
        this.context = context;
        this.nameInput = document.getElementById("board-name-input");
        this.nameButton = document.getElementById("update-name-button");
        this.colsInput = document.getElementById("cols-input");
        this.rowsInput = document.getElementById("rows-input");
        this.dimsButton = document.getElementById("update-dimensions-button");
        this.autoSaveToggle = document.getElementById("auto-save-toggle");
        this.deleteBoardButton = document.getElementById("delete-board-button");
        this.allControls = [
            this.nameInput,
            this.nameButton,
            this.colsInput,
            this.rowsInput,
            this.dimsButton,
            this.autoSaveToggle,
            this.deleteBoardButton,
        ].filter((el) => el !== null);
        if (this.allControls.length < 7) {
            console.error("BoardSettingsManager: Not all control elements were found.");
            this.disableAllControls();
            return;
        }
        this.init();
    }
    disableAllControls(disable = true) {
        this.allControls.forEach((el) => (el.disabled = disable));
    }
    init() {
        this.boardId = this.context.getBoardId();
        if (!this.boardId) {
            console.error("BoardSettingsManager: Board ID not found.");
            this.disableAllControls();
            return;
        }
        this.disableAllControls(false); // Enable controls if boardId is found
        const boardData = this.context.getBoardData();
        if (boardData) {
            this.initializePanel(boardData);
        }
        else {
            // Listen for an event that signals board data is loaded,
            // or rely on the main app to call initializePanel explicitly.
            // For now, we assume main app calls initializePanel or ensures data is present.
            console.warn("BoardSettingsManager: Initial board data not available at construction.");
        }
        this.addEventListeners();
    }
    initializePanel(boardData) {
        var _a, _b;
        if (!boardData || !boardData.route) {
            console.warn("BoardSettingsManager: Board data for settings panel is incomplete.");
            return;
        }
        this.nameInput.value = boardData.route.name || "";
        this.colsInput.value = ((_a = boardData.route.cols) === null || _a === void 0 ? void 0 : _a.toString()) || "";
        this.rowsInput.value = ((_b = boardData.route.rows) === null || _b === void 0 ? void 0 : _b.toString()) || "";
        this.autoSaveToggle.checked = boardData.route.auto_save_enabled || false;
    }
    addEventListeners() {
        var _a, _b, _c, _d;
        (_a = this.nameButton) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => this.handleUpdateName());
        (_b = this.dimsButton) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => this.handleUpdateDimensions());
        (_c = this.autoSaveToggle) === null || _c === void 0 ? void 0 : _c.addEventListener("change", () => this.handleToggleAutoSave());
        (_d = this.deleteBoardButton) === null || _d === void 0 ? void 0 : _d.addEventListener("click", () => this.handleDeleteBoard());
    }
    handleUpdateName() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.boardId)
                return;
            const newName = this.nameInput.value.trim();
            if (!newName) {
                alert("Board name cannot be empty.");
                return;
            }
            const oldName = ((_a = this.context.getBoardData()) === null || _a === void 0 ? void 0 : _a.route.name) || "";
            this.context.updateBoardNameInState(newName); // Optimistic UI update in main state
            this.context.updatePageTitle(newName); // Update H1 title on page
            if (this.context.isAutoSaveMode()) {
                try {
                    const response = yield fetch(`/gallery/route/${this.boardId}/update-name/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": this.context.getCsrfToken(),
                        },
                        body: JSON.stringify({ name: newName }),
                    });
                    const data = yield response.json();
                    if (!response.ok)
                        throw new Error(data.error || `HTTP error ${response.status}`);
                    if (data.status !== "success") {
                        throw new Error(data.message || "Failed to update name on server");
                    }
                    // Name is already updated in context state by data.name from server if different
                    // this.context.updateBoardNameInState(data.name); // if server can transform name
                    // this.context.updatePageTitle(data.name);
                }
                catch (err) {
                    console.error("Error auto-saving name:", err);
                    alert(`Error updating name: ${err.message}`);
                    this.context.updateBoardNameInState(oldName); // Revert optimistic
                    this.context.updatePageTitle(oldName);
                    this.nameInput.value = oldName;
                }
            }
            else {
                // Manual save mode: queue change
                const changeQueued = this.context.findAndModifyPendingChange((op) => op.type === "update_name" && op.boardId === this.boardId, (op) => (op.newName = newName));
                if (!changeQueued) {
                    this.context.addPendingChange({
                        type: "update_name",
                        boardId: this.boardId,
                        newName: newName,
                        oldName: oldName,
                    });
                }
                this.context.updateSaveChangesButtonState();
            }
        });
    }
    handleUpdateDimensions() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.boardId)
                return;
            const newCols = parseInt(this.colsInput.value);
            const newRows = parseInt(this.rowsInput.value);
            if (isNaN(newCols) ||
                isNaN(newRows) ||
                newCols < 1 ||
                newCols > 12 ||
                newRows < 1 ||
                newRows > 12) {
                alert("Columns and Rows must be numbers between 1 and 12.");
                return;
            }
            const boardData = this.context.getBoardData();
            const oldCols = boardData === null || boardData === void 0 ? void 0 : boardData.route.cols;
            const oldRows = boardData === null || boardData === void 0 ? void 0 : boardData.route.rows;
            let proceed = true;
            if (boardData &&
                (newCols < boardData.route.cols || newRows < boardData.route.rows)) {
                proceed = confirm("Reducing board dimensions may delete points outside the new bounds (and their pairs). This will be finalized upon saving. Continue?");
            }
            if (!proceed)
                return;
            this.context.updateBoardDimensionsInState(newCols, newRows); // Optimistic update
            if (this.context.isAutoSaveMode()) {
                try {
                    const response = yield fetch(`/gallery/route/${this.boardId}/update-dimensions/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": this.context.getCsrfToken(),
                        },
                        body: JSON.stringify({ cols: newCols, rows: newRows }),
                    });
                    const data = yield response.json();
                    if (!response.ok)
                        throw new Error(data.error || data.message || `HTTP error ${response.status}`);
                    if (data.status !== "success") {
                        throw new Error(data.message || "Failed to update dimensions on server");
                    }
                    // Server returns new dimensions and potentially updated points.
                    // The main app should handle this full refresh.
                    yield this.context.fetchBoardDataAndRenderAll();
                }
                catch (err) {
                    console.error("Error auto-saving dimensions:", err);
                    alert(`Error updating dimensions: ${err.message}`);
                    if (oldCols !== undefined && oldRows !== undefined) {
                        this.context.updateBoardDimensionsInState(oldCols, oldRows); // Revert
                        this.colsInput.value = oldCols.toString();
                        this.rowsInput.value = oldRows.toString();
                        this.context.rebuildBoardVisuals(oldCols, oldRows, this.context.getCurrentPointsData());
                    }
                }
            }
            else {
                // Manual save: update visuals locally and queue
                this.context.rebuildBoardVisuals(newCols, newRows, this.context.getCurrentPointsData()); // Pass current points
                const changeQueued = this.context.findAndModifyPendingChange((op) => op.type === "update_dimensions" && op.boardId === this.boardId, (op) => {
                    op.newCols = newCols;
                    op.newRows = newRows;
                });
                if (!changeQueued) {
                    this.context.addPendingChange({
                        type: "update_dimensions",
                        boardId: this.boardId,
                        newCols,
                        newRows,
                        oldCols,
                        oldRows,
                    });
                }
                this.context.updateSaveChangesButtonState();
            }
        });
    }
    handleToggleAutoSave() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.boardId)
                return;
            const autoSaveEnabled = this.autoSaveToggle.checked;
            const originalToggleState = !autoSaveEnabled;
            try {
                const response = yield fetch(`/gallery/api/board/${this.boardId}/toggle-autosave/`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": this.context.getCsrfToken(),
                    },
                    body: JSON.stringify({ auto_save_enabled: autoSaveEnabled }),
                });
                const data = yield response.json();
                if (!response.ok)
                    throw new Error(data.error || `HTTP error ${response.status}`);
                if (data.status === "success") {
                    this.context.setBoardAutoSaveFlagInState(data.auto_save_enabled);
                    window.dispatchEvent(new CustomEvent("autoSaveModeChanged", {
                        detail: { auto_save_enabled: data.auto_save_enabled },
                    }));
                }
                else {
                    throw new Error(data.message || "Failed to update auto-save mode");
                }
            }
            catch (err) {
                console.error("Error toggling auto-save:", err);
                alert(`Error: ${err.message}`);
                this.autoSaveToggle.checked = originalToggleState;
            }
        });
    }
    handleDeleteBoard() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.boardId)
                return;
            if (confirm("Are you sure you want to delete this board? This action is permanent and cannot be undone.")) {
                try {
                    const response = yield fetch(`/gallery/route/${this.boardId}/delete/`, {
                        method: "DELETE",
                        headers: { "X-CSRFToken": this.context.getCsrfToken() },
                    });
                    if (!response.ok) {
                        const data = yield response
                            .json()
                            .catch(() => ({ error: "Server error or non-JSON response" }));
                        throw new Error(data.error || `HTTP error ${response.status}`);
                    }
                    const data = yield response.json();
                    if (data.status === "success") {
                        window.location.href = data.redirect_url || "/gallery/";
                    }
                    else {
                        alert(`Failed to delete board: ${data.message || "Unknown error"}`);
                    }
                }
                catch (err) {
                    console.error("Error deleting board:", err);
                    alert(`Error deleting board: ${err.message}`);
                }
            }
        });
    }
}
//# sourceMappingURL=view_route_settings.js.map