// view_route_settings.ts

class BoardSettingsManager {
  private context: IRouteEditorContext;
  private boardId: string | null = null;

  // DOM Elements
  private nameInput: HTMLInputElement;
  private nameButton: HTMLButtonElement;
  private colsInput: HTMLInputElement;
  private rowsInput: HTMLInputElement;
  private dimsButton: HTMLButtonElement;
  private autoSaveToggle: HTMLInputElement;
  private deleteBoardButton: HTMLButtonElement;

  private allControls: (HTMLInputElement | HTMLButtonElement)[];

  constructor(context: IRouteEditorContext) {
    this.context = context;

    this.nameInput = document.getElementById(
      "board-name-input"
    ) as HTMLInputElement;
    this.nameButton = document.getElementById(
      "update-name-button"
    ) as HTMLButtonElement;
    this.colsInput = document.getElementById("cols-input") as HTMLInputElement;
    this.rowsInput = document.getElementById("rows-input") as HTMLInputElement;
    this.dimsButton = document.getElementById(
      "update-dimensions-button"
    ) as HTMLButtonElement;
    this.autoSaveToggle = document.getElementById(
      "auto-save-toggle"
    ) as HTMLInputElement;
    this.deleteBoardButton = document.getElementById(
      "delete-board-button"
    ) as HTMLButtonElement;

    this.allControls = [
      this.nameInput,
      this.nameButton,
      this.colsInput,
      this.rowsInput,
      this.dimsButton,
      this.autoSaveToggle,
      this.deleteBoardButton,
    ].filter((el) => el !== null) as (HTMLInputElement | HTMLButtonElement)[];

    if (this.allControls.length < 7) {
      console.error(
        "BoardSettingsManager: Not all control elements were found."
      );
      this.disableAllControls();
      return;
    }
    this.init();
  }

  private disableAllControls(disable: boolean = true): void {
    this.allControls.forEach((el) => (el.disabled = disable));
  }

  public init(): void {
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
    } else {
      // Listen for an event that signals board data is loaded,
      // or rely on the main app to call initializePanel explicitly.
      // For now, we assume main app calls initializePanel or ensures data is present.
      console.warn(
        "BoardSettingsManager: Initial board data not available at construction."
      );
    }

    this.addEventListeners();
  }

  public initializePanel(boardData: BoardData): void {
    if (!boardData || !boardData.route) {
      console.warn(
        "BoardSettingsManager: Board data for settings panel is incomplete."
      );
      return;
    }
    this.nameInput.value = boardData.route.name || "";
    this.colsInput.value = boardData.route.cols?.toString() || "";
    this.rowsInput.value = boardData.route.rows?.toString() || "";
    this.autoSaveToggle.checked = boardData.route.auto_save_enabled || false;
  }

  private addEventListeners(): void {
    this.nameButton?.addEventListener("click", () => this.handleUpdateName());
    this.dimsButton?.addEventListener("click", () =>
      this.handleUpdateDimensions()
    );
    this.autoSaveToggle?.addEventListener("change", () =>
      this.handleToggleAutoSave()
    );
    this.deleteBoardButton?.addEventListener("click", () =>
      this.handleDeleteBoard()
    );
  }

  private async handleUpdateName(): Promise<void> {
    if (!this.boardId) return;
    const newName = this.nameInput.value.trim();
    if (!newName) {
      alert("Board name cannot be empty.");
      return;
    }

    const oldName = this.context.getBoardData()?.route.name || "";
    this.context.updateBoardNameInState(newName); // Optimistic UI update in main state
    this.context.updatePageTitle(newName); // Update H1 title on page

    if (this.context.isAutoSaveMode()) {
      try {
        const response = await fetch(
          `/gallery/route/${this.boardId}/update-name/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": this.context.getCsrfToken(),
            },
            body: JSON.stringify({ name: newName }),
          }
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || `HTTP error ${response.status}`);
        if (data.status !== "success") {
          throw new Error(data.message || "Failed to update name on server");
        }
        // Name is already updated in context state by data.name from server if different
        // this.context.updateBoardNameInState(data.name); // if server can transform name
        // this.context.updatePageTitle(data.name);
      } catch (err) {
        console.error("Error auto-saving name:", err);
        alert(`Error updating name: ${(err as Error).message}`);
        this.context.updateBoardNameInState(oldName); // Revert optimistic
        this.context.updatePageTitle(oldName);
        this.nameInput.value = oldName;
      }
    } else {
      // Manual save mode: queue change
      const changeQueued = this.context.findAndModifyPendingChange(
        (op) => op.type === "update_name" && op.boardId === this.boardId,
        (op) => (op.newName = newName)
      );
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
  }

  private async handleUpdateDimensions(): Promise<void> {
    if (!this.boardId) return;
    const newCols = parseInt(this.colsInput.value);
    const newRows = parseInt(this.rowsInput.value);

    if (
      isNaN(newCols) ||
      isNaN(newRows) ||
      newCols < 1 ||
      newCols > 12 ||
      newRows < 1 ||
      newRows > 12
    ) {
      alert("Columns and Rows must be numbers between 1 and 12.");
      return;
    }

    const boardData = this.context.getBoardData();
    const oldCols = boardData?.route.cols;
    const oldRows = boardData?.route.rows;

    let proceed = true;
    if (
      boardData &&
      (newCols < boardData.route.cols || newRows < boardData.route.rows)
    ) {
      proceed = confirm(
        "Reducing board dimensions may delete points outside the new bounds (and their pairs). This will be finalized upon saving. Continue?"
      );
    }
    if (!proceed) return;

    this.context.updateBoardDimensionsInState(newCols, newRows); // Optimistic update

    if (this.context.isAutoSaveMode()) {
      try {
        const response = await fetch(
          `/gallery/route/${this.boardId}/update-dimensions/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": this.context.getCsrfToken(),
            },
            body: JSON.stringify({ cols: newCols, rows: newRows }),
          }
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || data.message || `HTTP error ${response.status}`
          );
        if (data.status !== "success") {
          throw new Error(
            data.message || "Failed to update dimensions on server"
          );
        }
        // Server returns new dimensions and potentially updated points.
        // The main app should handle this full refresh.
        await this.context.fetchBoardDataAndRenderAll();
      } catch (err) {
        console.error("Error auto-saving dimensions:", err);
        alert(`Error updating dimensions: ${(err as Error).message}`);
        if (oldCols !== undefined && oldRows !== undefined) {
          this.context.updateBoardDimensionsInState(oldCols, oldRows); // Revert
          this.colsInput.value = oldCols.toString();
          this.rowsInput.value = oldRows.toString();
          this.context.rebuildBoardVisuals(
            oldCols,
            oldRows,
            this.context.getCurrentPointsData()
          );
        }
      }
    } else {
      // Manual save: update visuals locally and queue
      this.context.rebuildBoardVisuals(
        newCols,
        newRows,
        this.context.getCurrentPointsData()
      ); // Pass current points

      const changeQueued = this.context.findAndModifyPendingChange(
        (op) => op.type === "update_dimensions" && op.boardId === this.boardId,
        (op) => {
          op.newCols = newCols;
          op.newRows = newRows;
        }
      );
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
  }

  private async handleToggleAutoSave(): Promise<void> {
    if (!this.boardId) return;
    const autoSaveEnabled = this.autoSaveToggle.checked;
    const originalToggleState = !autoSaveEnabled;

    try {
      const response = await fetch(
        `/gallery/api/board/${this.boardId}/toggle-autosave/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": this.context.getCsrfToken(),
          },
          body: JSON.stringify({ auto_save_enabled: autoSaveEnabled }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || `HTTP error ${response.status}`);

      if (data.status === "success") {
        this.context.setBoardAutoSaveFlagInState(data.auto_save_enabled);
        window.dispatchEvent(
          new CustomEvent("autoSaveModeChanged", {
            detail: { auto_save_enabled: data.auto_save_enabled },
          })
        );
      } else {
        throw new Error(data.message || "Failed to update auto-save mode");
      }
    } catch (err) {
      console.error("Error toggling auto-save:", err);
      alert(`Error: ${(err as Error).message}`);
      this.autoSaveToggle.checked = originalToggleState;
    }
  }

  private async handleDeleteBoard(): Promise<void> {
    if (!this.boardId) return;
    if (
      confirm(
        "Are you sure you want to delete this board? This action is permanent and cannot be undone."
      )
    ) {
      try {
        const response = await fetch(`/gallery/route/${this.boardId}/delete/`, {
          method: "DELETE",
          headers: { "X-CSRFToken": this.context.getCsrfToken() },
        });
        if (!response.ok) {
          const data = await response
            .json()
            .catch(() => ({ error: "Server error or non-JSON response" }));
          throw new Error(data.error || `HTTP error ${response.status}`);
        }
        const data = await response.json();
        if (data.status === "success") {
          window.location.href = data.redirect_url || "/gallery/";
        } else {
          alert(`Failed to delete board: ${data.message || "Unknown error"}`);
        }
      } catch (err) {
        console.error("Error deleting board:", err);
        alert(`Error deleting board: ${(err as Error).message}`);
      }
    }
  }
}
