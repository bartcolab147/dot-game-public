"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class PointAdder {
    constructor(context) {
        // Status text will be handled by context.updatePointAdderStatus
        this.selectedColor = "";
        this.selectedPoints = [];
        this.canSelectPoints = false;
        this.context = context;
        this.svg = this.context.getSvgElement(); // Get SVG from BoardRenderer via context
        this.pairColorInput = document.getElementById("pair-color");
        const pairStatusTextElement = document.getElementById("pair-selection-status"); // Used by context
        if (!this.svg) {
            console.error("PointAdder: SVG overlay is missing.");
            this.context.updatePointAdderStatus("Error: Board not initialized for point adding.", true);
            this.pairColorInput.disabled = true;
            return;
        }
        if (!this.pairColorInput || !pairStatusTextElement) {
            console.error("PointAdder: Color input or status text element is missing.");
            this.context.updatePointAdderStatus("Error: UI elements for point adding are missing.", true);
            this.pairColorInput.disabled = true;
            return;
        }
        this.init();
    }
    init() {
        this.addEventListeners();
        this.context.updatePointAdderStatus("Please select a color first.");
    }
    addEventListeners() {
        var _a;
        this.pairColorInput.addEventListener("input", (e) => this.handleColorChange(e));
        (_a = this.svg) === null || _a === void 0 ? void 0 : _a.addEventListener("click", (e) => this.handleSvgClick(e));
    }
    handleColorChange(e) {
        this.selectedColor = e.target.value;
        this.selectedPoints = [];
        document
            .querySelectorAll(".temp-highlight-marker")
            .forEach((m) => m.remove()); // Clear temp highlights
        if (!this.selectedColor) {
            this.canSelectPoints = false;
            this.context.updatePointAdderStatus("Please select a color first.");
            return;
        }
        if (this.context.isColorInUseOnBoard(this.selectedColor)) {
            this.canSelectPoints = false;
            this.context.updatePointAdderStatus(`Color ${this.selectedColor} is already in use. Delete existing points or choose a different one.`, true);
        }
        else {
            this.canSelectPoints = true;
            this.context.updatePointAdderStatus("Now, select two unoccupied points on the grid.");
        }
    }
    handleSvgClick(e) {
        if (!this.svg)
            return;
        if (!this.canSelectPoints) {
            if (!this.selectedColor) {
                this.context.updatePointAdderStatus("Please select a color first.", true);
            }
            else if (this.context.isColorInUseOnBoard(this.selectedColor)) {
                this.context.updatePointAdderStatus(`Color ${this.selectedColor} is already in use. Choose a different one.`, true);
            }
            else if (this.selectedPoints.length >= 2) {
                this.context.updatePointAdderStatus("Two points already selected. Processing...", true);
            }
            return;
        }
        if (e.target.closest("circle.point"))
            return; // Clicked on existing point
        const cellSize = this.context.getCellSize();
        if (cellSize <= 0) {
            this.context.updatePointAdderStatus("Error: Board not initialized properly (cellSize).", true);
            return;
        }
        const rect = this.svg.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / cellSize) + 1;
        const y = Math.floor((e.clientY - rect.top) / cellSize) + 1;
        const boardData = this.context.getBoardData();
        if (!boardData ||
            x < 1 ||
            x > boardData.route.cols ||
            y < 1 ||
            y > boardData.route.rows) {
            this.context.updatePointAdderStatus("Selected point is outside the board boundaries.", true);
            return;
        }
        if (this.selectedPoints.length < 2 &&
            !this.context.isCellOccupiedOnBoard(x, y)) {
            this.selectedPoints.push({ x, y });
            this.context.highlightPointOnBoard(x, y, this.selectedColor || "gray", true); // Temporary highlight
            this.context.updatePointAdderStatus(`Selected ${this.selectedPoints.length} point(s). Select ${2 - this.selectedPoints.length} more.`);
            if (this.selectedPoints.length === 2) {
                this.canSelectPoints = false; // Prevent further selection
                this.context.updatePointAdderStatus("Processing pair...");
                this.processNewPair(this.selectedPoints[0], this.selectedPoints[1], this.selectedColor);
            }
        }
        else if (this.context.isCellOccupiedOnBoard(x, y)) {
            this.context.updatePointAdderStatus("Cell is already occupied. Please select an empty cell.", true);
        }
        else if (this.selectedPoints.length >= 2) {
            this.context.updatePointAdderStatus("Two points already selected. Please wait or reset.", true);
        }
    }
    processNewPair(point1, point2, color) {
        return __awaiter(this, void 0, void 0, function* () {
            document
                .querySelectorAll(".temp-highlight-marker")
                .forEach((m) => m.remove());
            const boardId = this.context.getBoardId();
            if (!boardId) {
                this.context.updatePointAdderStatus("Error: Could not identify the board.", true);
                this.resetSelectionOnError();
                return;
            }
            if (this.context.isColorInUseOnBoard(color)) {
                // Final client-side check
                this.context.updatePointAdderStatus(`Error: Color ${color} is already in use. Operation cancelled.`, true);
                this.resetSelectionOnError();
                return;
            }
            if (this.context.isAutoSaveMode()) {
                try {
                    const response = yield fetch(`/gallery/points/add/${boardId}/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": this.context.getCsrfToken(),
                        },
                        body: JSON.stringify({
                            points: [
                                Object.assign(Object.assign({}, point1), { color }),
                                Object.assign(Object.assign({}, point2), { color }),
                            ],
                        }),
                    });
                    const data = yield response.json();
                    if (!response.ok) {
                        if (data.auto_save_off) {
                            // Server indicates auto-save was turned off
                            this.addPointsManually(point1, point2, color); // Fallback to manual
                            return;
                        }
                        throw new Error(data.error || `Server error ${response.status}`);
                    }
                    if (data.success && data.points && data.points.length === 2) {
                        this.context.updatePointAdderStatus("Pair auto-saved! Refreshing board...");
                        yield this.context.fetchBoardDataAndRenderAll(); // Full refresh
                        this.resetPairForm();
                    }
                    else {
                        throw new Error(data.error || "Failed to auto-save points or received invalid data.");
                    }
                }
                catch (err) {
                    console.error("Error auto-saving points:", err);
                    this.context.updatePointAdderStatus(`Error: ${err.message}. Please try again.`, true);
                    this.resetSelectionOnError();
                }
            }
            else {
                this.addPointsManually(point1, point2, color);
            }
        });
    }
    addPointsManually(point1, point2, color) {
        this.context.updatePointAdderStatus("Adding points locally...");
        const tempP1Id = `temp_${Date.now()}_1`;
        const tempP2Id = `temp_${Date.now()}_2`;
        const newPoint1Data = {
            id: tempP1Id,
            x: point1.x,
            y: point1.y,
            color,
        };
        const newPoint2Data = {
            id: tempP2Id,
            x: point2.x,
            y: point2.y,
            color,
        };
        // Context method handles adding to currentPointsData and drawing on SVG
        this.context.addPointsToStateAndPending([newPoint1Data, newPoint2Data], {
            type: "add",
            points: [
                Object.assign(Object.assign({}, point1), { color }),
                Object.assign(Object.assign({}, point2), { color }),
            ],
            temp_ids: [tempP1Id, tempP2Id],
        });
        // Visual update is handled by addPointsToStateAndPending calling rebuild or addPointToSvgGrid
        // Refreshing points list display and save button state is also handled by context or main app after state update
        this.context.updatePointAdderStatus("Pair added locally. Click 'Save Changes' to persist.");
        this.resetPairForm();
    }
    resetPairForm() {
        this.selectedPoints = [];
        this.pairColorInput.value = "";
        this.selectedColor = "";
        this.canSelectPoints = false;
        this.context.updatePointAdderStatus("Please select a color first.");
        document
            .querySelectorAll(".temp-highlight-marker")
            .forEach((m) => m.remove());
    }
    resetSelectionOnError() {
        this.selectedPoints = [];
        document
            .querySelectorAll(".temp-highlight-marker")
            .forEach((m) => m.remove());
        // Restore canSelectPoints based on current color state
        if (this.selectedColor &&
            !this.context.isColorInUseOnBoard(this.selectedColor)) {
            this.canSelectPoints = true;
            // Status message already set by caller or will be set by next color change
        }
        else {
            this.canSelectPoints = false;
        }
    }
    isExpectingInput() {
        return this.canSelectPoints;
    }
}
//# sourceMappingURL=view_route_point_adder.js.map