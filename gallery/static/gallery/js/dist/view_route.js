var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { BoardRenderer } from "./board_renderer.js";
class RouteEditorApp {
    constructor() {
        this.currentPointsData = [];
        this.pendingChanges = [];
        this.autoSaveModeEnabled = false;
        this.csrfToken = "";
        // --- IRouteEditorContext Implementation ---
        this.getBoardId = () => this.boardRenderer.getRouteIdFromUrl() || null;
        this.getCsrfToken = () => this.csrfToken;
        this.getBoardData = () => this.boardData;
        this.getCurrentPointsData = () => this.currentPointsData;
        this.getPendingChanges = () => this.pendingChanges;
        this.isAutoSaveMode = () => this.autoSaveModeEnabled;
        this.getCellSize = () => this.boardRenderer.cellSize;
        this.getSvgElement = () => this.boardRenderer.svgElement;
        this.updateBoardNameInState = (name) => {
            if (this.boardData)
                this.boardData.route.name = name;
        };
        this.updateBoardDimensionsInState = (cols, rows) => {
            if (this.boardData) {
                this.boardData.route.cols = cols;
                this.boardData.route.rows = rows;
            }
        };
        this.setBoardAutoSaveFlagInState = (enabled) => {
            this.autoSaveModeEnabled = enabled;
            if (this.boardData)
                this.boardData.route.auto_save_enabled = enabled;
            // The event dispatch is good, settingsManager handles it.
            // Or settingsManager could call this method on context.
        };
        this.addPendingChange = (change) => {
            this.pendingChanges.push(change);
        };
        this.findAndModifyPendingChange = (predicate, modifyFn) => {
            const opIndex = this.pendingChanges.findIndex(predicate);
            if (opIndex > -1) {
                modifyFn(this.pendingChanges[opIndex]);
                return true;
            }
            return false;
        };
        this.clearPendingChanges = () => {
            this.pendingChanges.length = 0;
        };
        this.setCurrentPointsData = (points) => {
            this.currentPointsData = [...points];
            if (this.boardData)
                this.boardData.points = this.currentPointsData; // Sync with boardData too
        };
        this.removePointsByColorFromState = (color) => {
            const removed = [];
            this.currentPointsData = this.currentPointsData.filter((p) => {
                if (p.color === color) {
                    removed.push(p);
                    this.removePointFromSvgGrid(p.id.toString());
                    return false;
                }
                return true;
            });
            if (this.boardData)
                this.boardData.points = this.currentPointsData;
            return removed;
        };
        this.removePointByIdFromState = (pointId) => {
            let removedPoint;
            this.currentPointsData = this.currentPointsData.filter((p) => {
                if (p.id.toString() === pointId) {
                    removedPoint = p;
                    this.removePointFromSvgGrid(p.id.toString());
                    return false;
                }
                return true;
            });
            if (this.boardData)
                this.boardData.points = this.currentPointsData;
            return removedPoint;
        };
        this.updatePageTitle = (name) => {
            if (this.routeNameElement)
                this.routeNameElement.textContent = name;
        };
        this.updateSaveChangesButtonState = () => {
            if (this.saveChangesButton) {
                const isDisabled = this.autoSaveModeEnabled || this.pendingChanges.length === 0;
                this.saveChangesButton.disabled = isDisabled;
                this.saveChangesButton.classList.toggle("opacity-50", isDisabled);
                this.saveChangesButton.classList.toggle("cursor-not-allowed", isDisabled);
            }
        };
        this.rebuildBoardVisuals = (cols, rows, points) => {
            const colsToUse = cols !== undefined ? cols : this.boardRenderer.cols;
            const rowsToUse = rows !== undefined ? rows : this.boardRenderer.rows;
            const pointsToUse = points !== undefined ? points : this.currentPointsData;
            this.boardRenderer.rebuildBoard(colsToUse, rowsToUse, pointsToUse);
            this.enablePointDragging(); // Re-enable dragging on new/re-rendered points
            this.refreshPointsListDisplay(); // Update points list display
            this.updateSaveChangesButtonState();
        };
        this.fetchBoardDataAndRenderAll = () => __awaiter(this, void 0, void 0, function* () {
            yield this.loadInitialBoardData();
        });
        this.highlightPointOnBoard = (x, y, color, isTemporary = false) => {
            // This method was previously global, now part of the app.
            const container = this.boardRenderer.getContainer();
            if (!container ||
                this.boardRenderer.cols === undefined ||
                this.boardRenderer.rows === undefined ||
                this.boardRenderer.cellSize <= 0)
                return;
            const existingSelector = isTemporary
                ? ".temp-highlight-marker"
                : ".highlight-marker";
            container.querySelectorAll(existingSelector).forEach((m) => m.remove());
            const radius = (0.8 * this.boardRenderer.cellSize) / 2;
            const marker = document.createElement("div");
            marker.className = isTemporary
                ? "temp-highlight-marker" // Used by PointAdder
                : "highlight-marker"; // Used by generic SVG click
            Object.assign(marker.style, {
                position: "absolute",
                left: `${(x - 1) * this.boardRenderer.cellSize + this.boardRenderer.cellSize / 2}px`,
                top: `${(y - 1) * this.boardRenderer.cellSize + this.boardRenderer.cellSize / 2}px`,
                width: `${radius * 2}px`,
                height: `${radius * 2}px`,
                borderRadius: "50%",
                border: `3px solid ${color}`,
                backgroundColor: "transparent",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: "10",
                boxSizing: "border-box",
            });
            container.appendChild(marker);
            if (!isTemporary)
                setTimeout(() => marker.remove(), 1000); // Auto-remove for generic highlights
        };
        this.addPointToSvgGrid = (circle, x, y) => {
            this.boardRenderer.addPointToGrid(circle, x, y);
        };
        this.removePointFromSvgGrid = (pointId) => {
            var _a;
            const circleToRemove = (_a = this.boardRenderer.svgElement) === null || _a === void 0 ? void 0 : _a.querySelector(`circle.point[data-point-id="${pointId}"]`);
            if (circleToRemove)
                circleToRemove.remove();
        };
        this.enablePointDragging = () => {
            if (!this.boardRenderer.svgElement)
                return;
            this.boardRenderer.svgElement
                .querySelectorAll("circle.point")
                .forEach((circle) => {
                var _a, _b, _c;
                const newCircle = circle.cloneNode(true);
                (_a = circle.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(newCircle, circle);
                let isDragging = false;
                const originalServerX = parseInt((_b = newCircle.dataset.x) !== null && _b !== void 0 ? _b : "0");
                const originalServerY = parseInt((_c = newCircle.dataset.y) !== null && _c !== void 0 ? _c : "0");
                let dragTargetX = originalServerX;
                let dragTargetY = originalServerY;
                newCircle.addEventListener("mousedown", (e) => {
                    var _a;
                    e.preventDefault();
                    e.stopPropagation();
                    isDragging = true;
                    newCircle.classList.add("dragging");
                    (_a = newCircle.parentNode) === null || _a === void 0 ? void 0 : _a.appendChild(newCircle);
                    const onMouseMove = (event) => {
                        if (!isDragging || !this.boardRenderer.svgElement)
                            return;
                        const rect = this.boardRenderer.svgElement.getBoundingClientRect();
                        const potentialX = Math.floor((event.clientX - rect.left) / this.boardRenderer.cellSize) + 1;
                        const potentialY = Math.floor((event.clientY - rect.top) / this.boardRenderer.cellSize) + 1;
                        if (potentialX >= 1 &&
                            potentialY >= 1 &&
                            potentialX <= this.boardRenderer.cols &&
                            potentialY <= this.boardRenderer.rows) {
                            if (this.isCellOccupiedOnBoard(potentialX, potentialY) &&
                                !(potentialX === parseInt(newCircle.dataset.x) &&
                                    potentialY === parseInt(newCircle.dataset.y))) {
                                const occupier = this.currentPointsData.find((p) => p.x === potentialX && p.y === potentialY);
                                if (occupier &&
                                    occupier.id.toString() !== newCircle.dataset.pointId)
                                    return;
                            }
                            dragTargetX = potentialX;
                            dragTargetY = potentialY;
                            this.boardRenderer.addPointToGrid(newCircle, dragTargetX, dragTargetY);
                        }
                    };
                    const onMouseUp = () => {
                        if (!isDragging)
                            return;
                        isDragging = false;
                        newCircle.classList.remove("dragging");
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                        const pointIdStr = newCircle.dataset.pointId;
                        if (pointIdStr &&
                            (dragTargetX !== originalServerX ||
                                dragTargetY !== originalServerY)) {
                            this.handlePointUpdate(pointIdStr, dragTargetX, dragTargetY, newCircle, originalServerX, originalServerY);
                        }
                        else {
                            this.boardRenderer.addPointToGrid(newCircle, originalServerX, originalServerY); // Snap back
                        }
                    };
                    document.addEventListener("mousemove", onMouseMove);
                    document.addEventListener("mouseup", onMouseUp);
                });
            });
        };
        this.refreshPointsListDisplay = () => {
            this.renderPointsListInternal(this.currentPointsData);
        };
        this.isCellOccupiedOnBoard = (x, y) => {
            return this.currentPointsData.some((p) => p.x === x && p.y === y);
        };
        this.isColorInUseOnBoard = (color) => {
            return this.currentPointsData.some((p) => p.color === color);
        };
        this.updatePointAdderStatus = (message, isError = false) => {
            if (this.pairSelectionStatusElement) {
                this.pairSelectionStatusElement.textContent = message;
                this.pairSelectionStatusElement.style.color = isError ? "red" : "inherit";
            }
        };
        this.addPointsToStateAndPending = (pointsData, addOperation) => {
            pointsData.forEach((pd) => {
                this.currentPointsData.push(pd);
                const circle = this.boardRenderer.renderSinglePoint(pd); // Add to SVG
                if (circle)
                    this.boardRenderer.addPointToGrid(circle, pd.x, pd.y); // Position it
            });
            if (this.boardData)
                this.boardData.points = [...this.currentPointsData];
            this.addPendingChange(addOperation);
            this.enablePointDragging(); // New points need dragging
            this.refreshPointsListDisplay();
            this.updateSaveChangesButtonState();
        };
        // Critical DOM Elements for BoardRenderer
        const boardContainerId = "dotBoard";
        const gridElementId = "board-grid";
        const svgElementId = "overlay-svg";
        this.boardRenderer = new BoardRenderer({
            containerId: boardContainerId,
            gridId: gridElementId,
            svgId: svgElementId,
        });
        // DOM elements for this main app
        this.pointsListUL = document.getElementById("points-list-ul");
        this.noPointsMessage = document.getElementById("no-points-message");
        this.saveChangesButton = document.getElementById("save-board-button");
        this.routeNameElement = document.querySelector("h1.text-3xl");
        this.xInputForCoordClick = document.getElementById("id_x");
        this.yInputForCoordClick = document.getElementById("id_y");
        this.pairSelectionStatusElement = document.getElementById("pair-selection-status");
        this.fetchCsrfToken();
        this.init();
    }
    fetchCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) {
            this.csrfToken = meta.content;
            return;
        }
        const cookie = document.cookie.match(/csrftoken=([^;]+)/);
        this.csrfToken = cookie ? cookie[1] : "";
        if (!this.csrfToken)
            console.warn("CSRF token not found.");
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (document.getElementById("settings-panel")) {
                this.settingsManager = new BoardSettingsManager(this);
            }
            if (document.getElementById("form-panel")) {
                // Assuming point adder is in form-panel
                this.pointAdder = new PointAdder(this);
            }
            // PanelManager is self-contained, instantiated separately
            this.addEventListeners();
            yield this.loadInitialBoardData();
        });
    }
    addEventListeners() {
        var _a, _b;
        (_a = this.saveChangesButton) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => this.savePendingChanges());
        // Listen to boardRenderer's SVG for coordinate clicks (if not handled by PointAdder exclusively)
        (_b = this.boardRenderer.svgElement) === null || _b === void 0 ? void 0 : _b.addEventListener("click", (e) => this.handleSvgCoordClick(e));
        // Listen for autoSaveModeChanged events possibly dispatched by settingsManager
        window.addEventListener("autoSaveModeChanged", (e) => {
            const newMode = e.detail.auto_save_enabled;
            if (this.autoSaveModeEnabled !== newMode) {
                this.autoSaveModeEnabled = newMode;
                if (this.boardData)
                    this.boardData.route.auto_save_enabled = newMode;
                if (this.autoSaveModeEnabled && this.pendingChanges.length > 0) {
                    if (confirm("Auto-save is now enabled. You have unsaved changes. Save them now?")) {
                        this.savePendingChanges();
                    }
                }
                this.updateSaveChangesButtonState();
            }
        });
        // Listen for boardDataLoaded from BoardRenderer
        window.addEventListener("boardDataLoaded", (e) => {
            var _a;
            this.boardData = e.detail;
            this.currentPointsData = [...(this.boardData.points || [])];
            this.autoSaveModeEnabled = this.boardData.route.auto_save_enabled;
            this.updatePageTitle(this.boardData.route.name);
            (_a = this.settingsManager) === null || _a === void 0 ? void 0 : _a.initializePanel(this.boardData); // Inform settings panel
            this.refreshPointsListDisplay();
            this.enablePointDragging();
            this.updateSaveChangesButtonState();
        });
    }
    // --- Internal Methods ---
    loadInitialBoardData() {
        return __awaiter(this, void 0, void 0, function* () {
            const routeId = this.getBoardId();
            if (!routeId) {
                console.error("RouteEditorApp: Route ID not found. Cannot load board.");
                // Display error in UI if container is accessible
                return;
            }
            yield this.boardRenderer.loadAndRenderBoard(routeId);
        });
    }
    handleSvgCoordClick(e) {
        if (this.pointAdder && this.pointAdder.isExpectingInput()) {
            return;
        }
        if (!this.xInputForCoordClick ||
            !this.yInputForCoordClick ||
            this.boardRenderer.cols === undefined ||
            this.boardRenderer.rows === undefined ||
            this.boardRenderer.cellSize <= 0 ||
            !this.boardRenderer.svgElement)
            return;
        const targetElement = e.target;
        if (targetElement.classList.contains("point") ||
            targetElement.closest("#overlay-svg") !== this.boardRenderer.svgElement) {
            return;
        }
        const rect = this.boardRenderer.svgElement.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.boardRenderer.cellSize) + 1;
        const y = Math.floor((e.clientY - rect.top) / this.boardRenderer.cellSize) + 1;
        if (x >= 1 &&
            x <= this.boardRenderer.cols &&
            y >= 1 &&
            y <= this.boardRenderer.rows &&
            !this.isCellOccupiedOnBoard(x, y)) {
            this.xInputForCoordClick.value = x.toString();
            this.yInputForCoordClick.value = y.toString();
            this.highlightPointOnBoard(x, y, "rgba(0,0,255,0.5)", false);
        }
    }
    handlePointUpdate(idStr, newX, newY, circleElement, oldX, oldY) {
        return __awaiter(this, void 0, void 0, function* () {
            const pointIndex = this.currentPointsData.findIndex((p) => p.id.toString() === idStr);
            if (pointIndex === -1) {
                console.error("Point to update not found in local cache:", idStr);
                this.boardRenderer.addPointToGrid(circleElement, oldX, oldY); // Revert visual
                return;
            }
            const originalPointData = Object.assign({}, this.currentPointsData[pointIndex]);
            this.currentPointsData[pointIndex].x = newX;
            this.currentPointsData[pointIndex].y = newY;
            circleElement.dataset.x = newX.toString();
            circleElement.dataset.y = newY.toString();
            if (this.boardData)
                this.boardData.points = [...this.currentPointsData]; // Sync boardData
            this.refreshPointsListDisplay();
            if (this.autoSaveModeEnabled) {
                if (typeof this.currentPointsData[pointIndex].id !== "number") {
                    alert("Auto-save for drag is only for persisted points.");
                    this.currentPointsData[pointIndex] = originalPointData; // Revert data
                    if (this.boardData)
                        this.boardData.points = [...this.currentPointsData];
                    this.boardRenderer.addPointToGrid(circleElement, oldX, oldY);
                    this.refreshPointsListDisplay();
                    return;
                }
                try {
                    const response = yield fetch(`/gallery/points/update/${this.getBoardId()}/${idStr}/`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": this.csrfToken,
                        },
                        body: JSON.stringify({ x: newX, y: newY }),
                    });
                    const data = yield response.json();
                    if (!response.ok) {
                        if (data.auto_save_off) {
                            // Server turned off auto-save
                            this.addPendingChange({
                                type: "update",
                                pointId: idStr,
                                x: newX,
                                y: newY,
                                oldX,
                                oldY,
                            });
                            this.updateSaveChangesButtonState();
                            return;
                        }
                        throw new Error(data.error || `Failed to update point: ${response.status}`);
                    }
                    if (!(data && data.success)) {
                        throw new Error(data.error || "Server reported update failure.");
                    }
                }
                catch (err) {
                    console.error("Auto-save update error:", err);
                    this.currentPointsData[pointIndex] = originalPointData; // Revert data
                    if (this.boardData)
                        this.boardData.points = [...this.currentPointsData];
                    this.boardRenderer.addPointToGrid(circleElement, oldX, oldY);
                    this.refreshPointsListDisplay();
                    alert(`Error auto-saving point: ${err.message}`);
                }
            }
            else {
                // Manual save mode
                let changeModified = false;
                if (typeof this.currentPointsData[pointIndex].id === "string") {
                    // Temp point being dragged
                    const tempId = idStr;
                    changeModified = this.findAndModifyPendingChange((op) => { var _a; return op.type === "add" && ((_a = op.temp_ids) === null || _a === void 0 ? void 0 : _a.includes(tempId)); }, (op) => {
                        const pIdxInAdd = op.temp_ids.indexOf(tempId);
                        if (pIdxInAdd !== -1) {
                            op.points[pIdxInAdd].x = newX;
                            op.points[pIdxInAdd].y = newY;
                        }
                    });
                }
                else {
                    // Persisted point
                    changeModified = this.findAndModifyPendingChange((op) => op.type === "update" && op.pointId.toString() === idStr, (op) => {
                        op.x = newX;
                        op.y = newY; /* oldX, oldY remain original */
                    });
                }
                if (!changeModified) {
                    this.addPendingChange({
                        type: "update",
                        pointId: idStr,
                        x: newX,
                        y: newY,
                        oldX,
                        oldY,
                    });
                }
                this.updateSaveChangesButtonState();
            }
        });
    }
    renderPointsListInternal(points) {
        if (!this.pointsListUL || !this.noPointsMessage)
            return;
        this.pointsListUL.innerHTML = "";
        if (points.length === 0) {
            this.noPointsMessage.classList.remove("hidden");
            return;
        }
        this.noPointsMessage.classList.add("hidden");
        const grouped = points.reduce((acc, point) => {
            acc[point.color] = acc[point.color] || [];
            acc[point.color].push(point);
            acc[point.color].sort((a, b) => typeof a.id === "string" && typeof b.id === "string"
                ? a.id.localeCompare(b.id)
                : typeof a.id === "number" && typeof b.id === "number"
                    ? a.id - b.id
                    : typeof a.id === "string"
                        ? -1
                        : 1);
            return acc;
        }, {});
        Object.keys(grouped)
            .sort()
            .forEach((color) => {
            const pair = grouped[color];
            const listItem = document.createElement("li");
            listItem.className =
                "flex items-center justify-start space-x-4 bg-gray-100 p-4 rounded-lg shadow-sm";
            const colorDot = document.createElement("div");
            colorDot.className = "w-8 h-8 rounded-full flex-shrink-0";
            colorDot.style.backgroundColor = color;
            listItem.appendChild(colorDot);
            const pointsContainer = document.createElement("div");
            pointsContainer.className = "flex space-x-4";
            for (let i = 0; i < 2; i++) {
                const pointData = pair[i];
                const pointDiv = document.createElement("div");
                pointDiv.className =
                    "point-list-item flex items-center space-x-2 bg-white p-2 rounded-full shadow-sm cursor-pointer";
                if (pointData) {
                    pointDiv.dataset.pointId = pointData.id.toString();
                    pointDiv.addEventListener("click", (event) => {
                        if (event.target.closest(".delete-point-btn"))
                            return;
                        this.highlightPointOnBoard(pointData.x, pointData.y, pointData.color);
                    });
                    const span = document.createElement("span");
                    span.className = "text-sm";
                    span.textContent = `(${pointData.x}, ${pointData.y})`;
                    pointDiv.appendChild(span);
                    const deleteButton = document.createElement("button");
                    deleteButton.type = "button";
                    deleteButton.className =
                        "delete-point-btn text-red-500 hover:text-red-700";
                    deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" fill="none" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>`;
                    deleteButton.dataset.colorGroup = pointData.color;
                    deleteButton.addEventListener("click", (e) => {
                        e.stopPropagation();
                        this.handleDeletePointOrPair(pointData.color);
                    });
                    pointDiv.appendChild(deleteButton);
                }
                else {
                    pointDiv.appendChild(document.createTextNode("( , )")); // Placeholder
                }
                pointsContainer.appendChild(pointDiv);
            }
            listItem.appendChild(pointsContainer);
            this.pointsListUL.appendChild(listItem);
        });
    }
    handleDeletePointOrPair(colorGroupToDelete) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!confirm(`Are you sure you want to delete the point(s) with color ${colorGroupToDelete}? This will delete the pair.`))
                return;
            const pointsInGroup = this.currentPointsData.filter((p) => p.color === colorGroupToDelete);
            if (pointsInGroup.length === 0)
                return;
            const isAnyTemporaryInGroup = pointsInGroup.some((p) => typeof p.id === "string");
            if (this.autoSaveModeEnabled) {
                if (isAnyTemporaryInGroup) {
                    // Temp points only exist locally
                    this.removePointsByColorFromState(colorGroupToDelete);
                    this.pendingChanges = this.pendingChanges.filter((change) => !(change.type === "add" &&
                        change.points &&
                        change.points[0].color === colorGroupToDelete));
                    this.refreshPointsListDisplay();
                    this.updateSaveChangesButtonState();
                }
                else {
                    const idForApiCall = pointsInGroup[0].id; // API deletes by group via one ID
                    if (typeof idForApiCall !== "number") {
                        alert("Error: Cannot delete persisted pair without a valid ID in auto-save.");
                        return;
                    }
                    try {
                        const response = yield fetch(`/gallery/api/point/${idForApiCall}/delete/`, {
                            method: "DELETE",
                            headers: { "X-CSRFToken": this.csrfToken },
                        });
                        const data = yield response.json();
                        if (!response.ok)
                            throw new Error(data.error || `Failed to delete point pair ${response.statusText}`);
                        yield this.loadInitialBoardData(); // Refresh all data
                    }
                    catch (error) {
                        console.error("Error auto-saving delete:", error);
                        alert(`Error: ${error.message}`);
                    }
                }
            }
            else {
                // Manual save mode
                this.removePointsByColorFromState(colorGroupToDelete);
                if (isAnyTemporaryInGroup) {
                    // If it was a pending 'add', remove that 'add' op
                    this.pendingChanges = this.pendingChanges.filter((change) => !(change.type === "add" &&
                        change.points &&
                        change.points[0].color === colorGroupToDelete));
                }
                else {
                    // If it was persisted points, add 'delete' ops for them
                    pointsInGroup.forEach((p) => {
                        if (typeof p.id === "number" &&
                            !this.pendingChanges.some((op) => op.type === "delete" && op.pointId === p.id)) {
                            this.addPendingChange({
                                type: "delete",
                                pointId: p.id,
                                color: p.color,
                            });
                        }
                    });
                }
                // Clean up any 'update' ops for these points
                const idsToRemove = pointsInGroup.map((p) => p.id.toString());
                this.pendingChanges = this.pendingChanges.filter((change) => !(change.type === "update" &&
                    idsToRemove.includes(change.pointId.toString())));
                this.refreshPointsListDisplay();
                this.updateSaveChangesButtonState();
            }
        });
    }
    savePendingChanges() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (this.autoSaveModeEnabled || this.pendingChanges.length === 0) {
                alert("No pending changes to save or auto-save is enabled.");
                return;
            }
            if (!this.saveChangesButton)
                return;
            const originalButtonText = this.saveChangesButton.innerHTML;
            this.saveChangesButton.disabled = true;
            this.saveChangesButton.innerHTML = `<svg class="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...`;
            try {
                const response = yield fetch(`/gallery/api/board/${this.getBoardId()}/save-pending-changes/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": this.csrfToken,
                    },
                    body: JSON.stringify({ changes: this.pendingChanges }),
                });
                const data = yield response.json();
                if (!response.ok || data.status !== "success") {
                    throw new Error(data.error || data.message || "Failed to save pending changes.");
                }
                this.clearPendingChanges();
                this.setCurrentPointsData(data.all_points || []); // Server response is source of truth
                if (this.boardData && data.board_route_data) {
                    // Server might return updated route data too
                    this.boardData.route = data.board_route_data;
                }
                this.rebuildBoardVisuals((_a = this.boardData) === null || _a === void 0 ? void 0 : _a.route.cols, (_b = this.boardData) === null || _b === void 0 ? void 0 : _b.route.rows, this.currentPointsData);
                if ((_c = this.boardData) === null || _c === void 0 ? void 0 : _c.route.name)
                    this.updatePageTitle(this.boardData.route.name);
            }
            catch (error) {
                console.error("Error saving pending changes:", error);
                alert(`Error saving changes: ${error.message}`);
            }
            finally {
                this.saveChangesButton.innerHTML = originalButtonText;
                this.updateSaveChangesButtonState(); // Will re-enable if pendingChanges still > 0 (e.g. partial failure)
            }
        });
    }
}
window.addEventListener("DOMContentLoaded", () => {
    new RouteEditorApp();
    // PanelManager is instantiated in its own file
});
//# sourceMappingURL=view_route.js.map