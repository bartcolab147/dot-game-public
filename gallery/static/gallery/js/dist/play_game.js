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
// --- Global Variables & DOM Elements ---
let csrfToken = "";
let currentBoardId = "";
let game = null;
// --- Main Game Class ---
class FreeFlowGame {
    constructor(boardId, initialCsrfToken) {
        this.sessionId = null;
        this.points = [];
        this.clientPaths = new Map();
        this.hasUnsavedChanges = false;
        this.isDrawing = false;
        this.activeDrawingColor = null;
        this.currentDrawingSegments = [];
        this.tempPathElement = null;
        this.cellSize = 30;
        this.isSolvedState = false;
        this.drawingCompletedThisStroke = false;
        currentBoardId = boardId;
        csrfToken = initialCsrfToken;
        this.initializeDOMReferences();
        this.initGame();
    }
    initializeDOMReferences() {
        this.pathsSvg = document.getElementById("paths-svg");
        this.interactionSvg = document.getElementById("interaction-svg");
        this.saveProgressButton = document.getElementById("save-board-button");
        this.checkSolutionButton = document.getElementById("check-solution-button");
        this.resetPathsButton = document.getElementById("reset-all-paths-button");
        this.gameStatusElement = document.getElementById("game-status");
        this.unsavedIndicator = document.getElementById("unsaved-changes-indicator");
        this.boardRenderer = new BoardRenderer({
            containerId: "dotBoardContainer",
            gridId: "board-grid",
            svgId: "overlay-svg",
        });
        if (!this.pathsSvg ||
            !this.interactionSvg ||
            !this.saveProgressButton ||
            !this.checkSolutionButton ||
            !this.resetPathsButton ||
            !this.gameStatusElement ||
            !this.unsavedIndicator ||
            !this.boardRenderer) {
            console.error("FreeFlowGame: One or more critical game elements are missing.");
            throw new Error("Missing critical DOM elements for the game.");
        }
    }
    apiRequest(url_1) {
        return __awaiter(this, arguments, void 0, function* (url, method = "GET", body) {
            const headers = { "X-CSRFToken": csrfToken };
            if (method !== "GET" && method !== "HEAD") {
                headers["Content-Type"] = "application/json";
            }
            const config = { method, headers };
            if (body && method !== "GET" && method !== "HEAD") {
                config.body = JSON.stringify(body);
            }
            const response = yield fetch(url, config);
            if (!response.ok) {
                let errorData;
                try {
                    errorData = yield response.json();
                }
                catch (e) {
                    errorData = {
                        error: `Request failed with status ${response.status} ${response.statusText}`,
                    };
                }
                console.error("API Error:", errorData);
                const errorMessages = errorData.errors
                    ? JSON.stringify(errorData.errors)
                    : errorData.error ||
                        errorData.detail ||
                        `API request failed: ${response.status} ${response.statusText}`;
                this.updateGameStatus(`Error: ${errorMessages}`, true);
                throw new Error(errorMessages);
            }
            if (response.status === 204)
                return null;
            return response.json();
        });
    }
    initGame() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessionData = yield this.apiRequest(`/gallery/api/game/board/${currentBoardId}/session/`);
                this.sessionId = sessionData.id;
                this.boardConfig = sessionData.board_details.route;
                this.points = sessionData.board_details.points;
                this.isSolvedState = sessionData.is_solved;
                const boardTitleElement = document.getElementById("board-title"); // Assuming you have an element with this ID
                if (boardTitleElement) {
                    boardTitleElement.textContent =
                        this.boardConfig.name || "Free Flow Game";
                }
                else {
                    // Fallback to h1 in play_game.html
                    const h1Title = document.querySelector("h1.text-2xl");
                    if (h1Title &&
                        h1Title.firstChild &&
                        h1Title.firstChild.nodeType === Node.TEXT_NODE) {
                        h1Title.firstChild.textContent = `Playing: ${this.boardConfig.name || "Free Flow Game"}`;
                    }
                }
                this.boardRenderer.rebuildBoard(this.boardConfig.cols, this.boardConfig.rows, this.points);
                this.cellSize = this.boardRenderer.cellSize;
                this.syncSvgDimensions();
                this.pathsSvg.innerHTML = "";
                this.clientPaths.clear();
                sessionData.paths.forEach((pathData) => {
                    this.clientPaths.set(pathData.color, {
                        color: pathData.color,
                        segments: pathData.path_data,
                    });
                    this.drawPermanentPath(pathData.color, pathData.path_data);
                });
                this.setUnsavedChanges(false); // This will also call updateButtonStatesAndIndicator
                if (this.isSolvedState) {
                    this.updateGameStatus("Board is already solved!", false, "success");
                }
                else {
                    this.updateGameStatus("Draw paths to connect the dots!", false, "info");
                }
                this.setupEventListeners();
                window.addEventListener("beforeunload", this.handleBeforeUnload.bind(this));
            }
            catch (error) {
                console.error("Error initializing game:", error);
                this.updateGameStatus(`Error initializing game: ${error.message}`, true);
            }
        });
    }
    updateGameStatus(message, isError = false, type = "info") {
        if (!this.gameStatusElement)
            return;
        this.gameStatusElement.textContent = message;
        let className = "mb-4 p-3 text-center rounded transition-all duration-300 ease-in-out ";
        if (isError)
            type = "error"; // Override type if isError is true for backward compatibility
        switch (type) {
            case "success":
                className += "bg-green-100 text-green-700";
                break;
            case "warning":
                className += "bg-yellow-100 text-yellow-700";
                break;
            case "error":
                className += "bg-red-100 text-red-700";
                break;
            case "info":
            default:
                className += "bg-blue-100 text-blue-700";
                break;
        }
        this.gameStatusElement.className = className;
    }
    syncSvgDimensions() {
        if (!this.boardRenderer)
            return;
        const { width, height } = this.boardRenderer.getBoardDimensions();
        [this.pathsSvg, this.interactionSvg].forEach((svg) => {
            if (svg) {
                svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
                svg.setAttribute("width", width.toString());
                svg.setAttribute("height", height.toString());
            }
        });
    }
    handleBeforeUnload(event) {
        if (this.hasUnsavedChanges)
            event.preventDefault();
    }
    setUnsavedChanges(status) {
        this.hasUnsavedChanges = status;
        this.updateButtonStatesAndIndicator();
    }
    updateButtonStatesAndIndicator() {
        if (this.isSolvedState) {
            this.interactionSvg.style.pointerEvents = "none";
            this.checkSolutionButton.disabled = true;
            // Save button is enabled if solved state IS an unsaved change.
            this.saveProgressButton.disabled = !this.hasUnsavedChanges;
        }
        else {
            this.interactionSvg.style.pointerEvents = "auto";
            this.checkSolutionButton.disabled = this.clientPaths.size === 0; // Disable if no paths drawn
            this.saveProgressButton.disabled = !this.hasUnsavedChanges;
        }
        this.resetPathsButton.disabled =
            this.clientPaths.size === 0 && !this.hasUnsavedChanges; // Enable if paths exist or if there are unsaved changes (like a cleared board)
        if (this.unsavedIndicator) {
            this.unsavedIndicator.style.display = this.hasUnsavedChanges
                ? "inline-block"
                : "none";
        }
    }
    setupEventListeners() {
        this.interactionSvg.addEventListener("mousedown", this.handleMouseDown.bind(this));
        this.interactionSvg.addEventListener("mousemove", this.handleMouseMove.bind(this));
        document.addEventListener("mouseup", this.handleMouseUp.bind(this));
        this.interactionSvg.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.handleMouseDown(e);
        }, { passive: false });
        this.interactionSvg.addEventListener("touchmove", (e) => {
            e.preventDefault();
            this.handleMouseMove(e);
        }, { passive: false });
        this.interactionSvg.addEventListener("touchend", (e) => {
            e.preventDefault();
            this.handleMouseUp(e);
        }, { passive: false });
        this.saveProgressButton.addEventListener("click", this.handleSaveProgress.bind(this));
        this.resetPathsButton.addEventListener("click", this.handleResetAllPaths.bind(this));
        this.checkSolutionButton.addEventListener("click", () => this.handleCheckSolution());
        window.addEventListener("resize", () => this.handleResizeGameElements());
    }
    handleResizeGameElements() {
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = window.setTimeout(() => {
            if (!this.boardConfig || !this.points)
                return; // Guard against undefined config
            this.boardRenderer.rebuildBoard(this.boardConfig.cols, this.boardConfig.rows, this.points);
            this.cellSize = this.boardRenderer.cellSize;
            this.syncSvgDimensions();
            this.pathsSvg.innerHTML = "";
            this.clientPaths.forEach((pathInfo, color) => {
                delete pathInfo.element;
                this.drawPermanentPath(color, pathInfo.segments);
            });
        }, 250);
    }
    getCellFromEvent(event) {
        if (!this.boardConfig || !this.interactionSvg)
            return null;
        const svgRect = this.interactionSvg.getBoundingClientRect();
        let clientX, clientY;
        if (event instanceof MouseEvent) {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        else {
            const touch = event.touches[0] || event.changedTouches[0];
            if (!touch)
                return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        }
        const x = Math.floor((clientX - svgRect.left) / this.cellSize) + 1;
        const y = Math.floor((clientY - svgRect.top) / this.cellSize) + 1;
        if (x >= 1 &&
            x <= this.boardConfig.cols &&
            y >= 1 &&
            y <= this.boardConfig.rows) {
            return { x, y };
        }
        return null;
    }
    createTempPathElement() {
        if (this.tempPathElement)
            this.tempPathElement.remove();
        this.tempPathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        this.tempPathElement.setAttribute("stroke", this.activeDrawingColor);
        this.tempPathElement.setAttribute("stroke-width", (this.cellSize * 0.45).toString());
        this.tempPathElement.setAttribute("fill", "none");
        this.tempPathElement.setAttribute("stroke-linecap", "round");
        this.tempPathElement.setAttribute("stroke-linejoin", "round");
        this.interactionSvg.appendChild(this.tempPathElement);
    }
    getPointAt(x, y) {
        return this.points.find((p) => p.x === x && p.y === y);
    }
    getPathOccupyingCell(x, y, excludeColor) {
        for (const [color, pathInfo] of this.clientPaths.entries()) {
            if (color === excludeColor)
                continue;
            if (pathInfo.segments.some((seg) => seg.x === x && seg.y === y)) {
                return pathInfo;
            }
        }
        return undefined;
    }
    removeClientPath(color) {
        this.removePermanentPathDisplay(color);
        this.clientPaths.delete(color);
        // setUnsavedChanges will be called by the function initiating this removal
    }
    handleMouseDown(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSolvedState)
                return;
            const cell = this.getCellFromEvent(event);
            if (!cell)
                return;
            const startingPoint = this.getPointAt(cell.x, cell.y);
            if (startingPoint) {
                this.isDrawing = true;
                this.activeDrawingColor = startingPoint.color;
                if (this.clientPaths.has(this.activeDrawingColor)) {
                    this.removeClientPath(this.activeDrawingColor);
                    this.setUnsavedChanges(true);
                }
                this.currentDrawingSegments = [cell];
                this.drawingCompletedThisStroke = false;
                this.createTempPathElement();
                this.updateTempPathDisplay();
            }
        });
    }
    handleMouseMove(event) {
        if (!this.isDrawing ||
            !this.activeDrawingColor ||
            !this.boardConfig ||
            this.drawingCompletedThisStroke)
            return;
        const targetCell = this.getCellFromEvent(event);
        if (!targetCell)
            return;
        const lastSegment = this.currentDrawingSegments[this.currentDrawingSegments.length - 1];
        if (targetCell.x === lastSegment.x && targetCell.y === lastSegment.y)
            return;
        const dx = Math.abs(targetCell.x - lastSegment.x);
        const dy = Math.abs(targetCell.y - lastSegment.y);
        let proposedSteps = [];
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
            proposedSteps = [targetCell];
        }
        else if (dx === 1 && dy === 1) {
            const option1_intermediate = { x: targetCell.x, y: lastSegment.y };
            const option2_intermediate = { x: lastSegment.x, y: targetCell.y };
            const evaluateOption = (intermediate, final) => {
                let hitsFP = false;
                const deletions = new Set();
                const segmentsToEvaluate = [intermediate, final];
                for (const seg of segmentsToEvaluate) {
                    const pointAtSeg = this.getPointAt(seg.x, seg.y);
                    if (pointAtSeg && pointAtSeg.color !== this.activeDrawingColor) {
                        hitsFP = true;
                        break;
                    }
                    const pathOccupy = this.getPathOccupyingCell(seg.x, seg.y, this.activeDrawingColor);
                    if (pathOccupy) {
                        deletions.add(pathOccupy.color);
                    }
                }
                return {
                    hitsForeignPoint: hitsFP,
                    deletesColors: deletions,
                    segments: [intermediate, final],
                };
            };
            const eval1 = evaluateOption(option1_intermediate, targetCell);
            const eval2 = evaluateOption(option2_intermediate, targetCell);
            const opt1Valid = !eval1.hitsForeignPoint;
            const opt2Valid = !eval2.hitsForeignPoint;
            if (opt1Valid && !opt2Valid) {
                proposedSteps = eval1.segments;
            }
            else if (!opt1Valid && opt2Valid) {
                proposedSteps = eval2.segments;
            }
            else if (opt1Valid && opt2Valid) {
                if (eval1.deletesColors.size <= eval2.deletesColors.size) {
                    proposedSteps = eval1.segments;
                }
                else {
                    proposedSteps = eval2.segments;
                }
            }
            else {
                return;
            }
        }
        else {
            return;
        }
        for (const stepCell of proposedSteps) {
            if (this.drawingCompletedThisStroke)
                break;
            if (this.currentDrawingSegments.length > 1 &&
                this.currentDrawingSegments[this.currentDrawingSegments.length - 2]
                    .x === stepCell.x &&
                this.currentDrawingSegments[this.currentDrawingSegments.length - 2]
                    .y === stepCell.y) {
                this.currentDrawingSegments.pop();
                this.drawingCompletedThisStroke = false;
                continue;
            }
            if (this.currentDrawingSegments.some((s) => s.x === stepCell.x && s.y === stepCell.y))
                return;
            const pointInCell = this.getPointAt(stepCell.x, stepCell.y);
            if (pointInCell && pointInCell.color !== this.activeDrawingColor)
                return;
            const pathToDeleteInfo = this.getPathOccupyingCell(stepCell.x, stepCell.y, this.activeDrawingColor);
            if (pathToDeleteInfo) {
                this.removeClientPath(pathToDeleteInfo.color);
                this.setUnsavedChanges(true);
            }
            this.currentDrawingSegments.push(stepCell);
            if (pointInCell && pointInCell.color === this.activeDrawingColor) {
                const startSegment = this.currentDrawingSegments[0];
                if (this.currentDrawingSegments.length > 1 &&
                    (pointInCell.x !== startSegment.x || pointInCell.y !== startSegment.y)) {
                    const colorEndpoints = this.points.filter((p) => p.color === this.activeDrawingColor);
                    if (colorEndpoints.length === 2) {
                        const p1 = colorEndpoints[0];
                        const p2 = colorEndpoints[1];
                        const currentPathStartPoint = this.getPointAt(startSegment.x, startSegment.y);
                        if (currentPathStartPoint &&
                            pointInCell &&
                            currentPathStartPoint.id !== pointInCell.id) {
                            if ((currentPathStartPoint.id === p1.id &&
                                pointInCell.id === p2.id) ||
                                (currentPathStartPoint.id === p2.id && pointInCell.id === p1.id)) {
                                this.drawingCompletedThisStroke = true;
                            }
                        }
                    }
                }
            }
        }
        this.updateTempPathDisplay();
    }
    handleMouseUp(event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isDrawing || !this.activeDrawingColor || !this.boardConfig) {
                this.cleanUpDrawingState();
                return;
            }
            const finalCell = this.currentDrawingSegments[this.currentDrawingSegments.length - 1];
            const startCell = this.currentDrawingSegments[0];
            const startPointData = this.getPointAt(startCell.x, startCell.y);
            const endPointData = this.getPointAt(finalCell.x, finalCell.y);
            let pathIsValidClientSide = false;
            if (this.currentDrawingSegments.length >= 2 &&
                startPointData &&
                endPointData) {
                if (startPointData.color === this.activeDrawingColor &&
                    endPointData.color === this.activeDrawingColor &&
                    startPointData.id !== endPointData.id) {
                    const colorEndpoints = this.points.filter((p) => p.color === this.activeDrawingColor);
                    if (colorEndpoints.length === 2) {
                        const p1 = colorEndpoints[0];
                        const p2 = colorEndpoints[1];
                        if ((startPointData.id === p1.id && endPointData.id === p2.id) ||
                            (startPointData.id === p2.id && endPointData.id === p1.id)) {
                            pathIsValidClientSide = true;
                        }
                    }
                    else if (colorEndpoints.length > 2) {
                        pathIsValidClientSide = true;
                    }
                }
            }
            if (pathIsValidClientSide) {
                this.clientPaths.set(this.activeDrawingColor, {
                    color: this.activeDrawingColor,
                    segments: [...this.currentDrawingSegments],
                });
                this.drawPermanentPath(this.activeDrawingColor, this.currentDrawingSegments);
                this.setUnsavedChanges(true);
            }
            else {
                this.removePermanentPathDisplay(this.activeDrawingColor);
                this.clientPaths.delete(this.activeDrawingColor);
                // If path was invalid, unsaved changes status might not need update unless a previous path was cleared.
                // `setUnsavedChanges(true)` is called if a path is cleared during mousedown or mousemove.
            }
            this.cleanUpDrawingState();
        });
    }
    cleanUpDrawingState() {
        this.isDrawing = false;
        this.activeDrawingColor = null;
        this.currentDrawingSegments = [];
        this.drawingCompletedThisStroke = false;
        if (this.tempPathElement) {
            this.tempPathElement.remove();
            this.tempPathElement = null;
        }
        this.updateButtonStatesAndIndicator(); // Ensure buttons are updated after drawing
    }
    updateTempPathDisplay() {
        if (!this.tempPathElement ||
            this.currentDrawingSegments.length === 0 ||
            !this.boardConfig)
            return;
        const pathD = this.currentDrawingSegments
            .map((seg, index) => {
            const cx = (seg.x - 0.5) * this.cellSize;
            const cy = (seg.y - 0.5) * this.cellSize;
            return (index === 0 ? "M" : "L") + `${cx},${cy}`;
        })
            .join(" ");
        this.tempPathElement.setAttribute("d", pathD);
    }
    drawPermanentPath(color, segments) {
        if (segments.length < 1 || !this.boardConfig || !this.pathsSvg)
            return;
        this.removePermanentPathDisplay(color);
        const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathEl.setAttribute("stroke", color);
        pathEl.setAttribute("stroke-width", (this.cellSize * 0.4).toString());
        pathEl.setAttribute("fill", "none");
        pathEl.setAttribute("stroke-linecap", "round");
        pathEl.setAttribute("stroke-linejoin", "round");
        pathEl.dataset.pathColor = color;
        const pathD = segments
            .map((seg, index) => {
            const cx = (seg.x - 0.5) * this.cellSize;
            const cy = (seg.y - 0.5) * this.cellSize;
            return (index === 0 ? "M" : "L") + `${cx},${cy}`;
        })
            .join(" ");
        pathEl.setAttribute("d", pathD);
        this.pathsSvg.appendChild(pathEl);
        const pathInfo = this.clientPaths.get(color);
        if (pathInfo) {
            pathInfo.element = pathEl;
            pathInfo.segments = segments;
        }
        else {
            this.clientPaths.set(color, { color, segments, element: pathEl });
        }
    }
    removePermanentPathDisplay(color) {
        const pathInfo = this.clientPaths.get(color);
        if (pathInfo === null || pathInfo === void 0 ? void 0 : pathInfo.element) {
            pathInfo.element.remove();
            delete pathInfo.element;
        }
        const existingPathEl = this.pathsSvg.querySelector(`path[data-path-color="${color}"]`);
        if (existingPathEl) {
            existingPathEl.remove();
        }
    }
    handleSaveProgress() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.sessionId) {
                this.updateGameStatus("Session ID not found. Cannot save.", true);
                return;
            }
            if (!this.hasUnsavedChanges && !this.isSolvedState) {
                // if not solved, and no unsaved changes
                // Allow saving if it's a newly solved state, even if hasUnsavedChanges was false before solving.
                if (this.isSolvedState && this.saveProgressButton.disabled) {
                    // This means it was solved but button implies nothing to save.
                    // This scenario needs careful handling in setUnsavedChanges and updateButtonStatesAndIndicator
                }
                else if (!this.hasUnsavedChanges) {
                    this.updateGameStatus("No changes to save.", false, "info");
                    return;
                }
            }
            this.saveProgressButton.disabled = true; // Disable immediately
            const pathsToSave = Array.from(this.clientPaths.values()).map((pInfo) => ({
                color: pInfo.color,
                path_data: pInfo.segments,
            }));
            try {
                const response = yield this.apiRequest(`/gallery/api/game/session/${this.sessionId}/save_all_paths/`, "POST", { paths: pathsToSave });
                this.isSolvedState = response.is_solved; // Update with server's authoritative state
                this.setUnsavedChanges(false); // This will re-evaluate button states
                const statusMessage = response.message +
                    (response.is_solved ? " Board is solved!" : " Progress saved.");
                this.updateGameStatus(statusMessage, false, response.is_solved ? "success" : "info");
            }
            catch (error) {
                //this.saveProgressButton.disabled = !this.hasUnsavedChanges || this.isSolvedState;
                this.updateButtonStatesAndIndicator(); // Re-enable based on current state if save failed
                // Error message already shown by apiRequest
            }
        });
    }
    handleResetAllPaths() {
        return __awaiter(this, void 0, void 0, function* () {
            let confirmReset = true;
            if (this.hasUnsavedChanges || this.clientPaths.size > 0) {
                confirmReset = confirm("Are you sure you want to reset all paths? Any unsaved progress will be lost.");
            }
            if (!confirmReset)
                return;
            this.clientPaths.forEach((pInfo) => { var _a; return (_a = pInfo.element) === null || _a === void 0 ? void 0 : _a.remove(); });
            if (this.pathsSvg)
                this.pathsSvg.innerHTML = "";
            this.clientPaths.clear();
            this.isSolvedState = false;
            this.setUnsavedChanges(true); // Board is now clear, this is an unsaved change to persist
            this.updateGameStatus("Board reset. Draw new paths!", false, "info");
            // updateButtonStatesAndIndicator is called by setUnsavedChanges
        });
    }
    checkSolutionLocally() {
        if (!this.boardConfig || this.points.length === 0) {
            return {
                isSolved: false,
                message: "Board configuration or points missing.",
                type: "warning",
            };
        }
        const requiredColors = new Set(this.points
            .map((p) => p.color)
            .filter((c) => {
            // Only include colors that have exactly two points.
            return this.points.filter((pt) => pt.color === c).length === 2;
        }));
        const drawnPathColors = new Set(this.clientPaths.keys());
        if (requiredColors.size === 0 && this.points.length > 0) {
            return {
                isSolved: false,
                message: "No valid (paired) points found on the board to connect.",
                type: "warning",
            };
        }
        if (requiredColors.size === 0 && this.points.length === 0) {
            // Empty board could be "solved"
            return {
                isSolved: true,
                message: "Empty board is considered solved.",
                type: "success",
            };
        }
        if (requiredColors.size !== drawnPathColors.size) {
            return {
                isSolved: false,
                message: "Not all required colors have a path.",
                type: "warning",
            };
        }
        for (const color of requiredColors) {
            if (!drawnPathColors.has(color)) {
                return {
                    isSolved: false,
                    message: `Path for color ${color} is missing.`,
                    type: "warning",
                };
            }
        }
        const allPathSegments = new Set();
        for (const [color, pathInfo] of this.clientPaths.entries()) {
            if (!requiredColors.has(color))
                continue; // Only check paths for valid, paired colors
            if (pathInfo.segments.length < 2) {
                return {
                    isSolved: false,
                    message: `Path for color ${color} is too short.`,
                    type: "warning",
                };
            }
            const startCell = pathInfo.segments[0];
            const endCell = pathInfo.segments[pathInfo.segments.length - 1];
            const colorEndpoints = this.points.filter((p) => p.color === color);
            // This check is already done by requiredColors filter, but defensive check:
            if (colorEndpoints.length !== 2) {
                return {
                    isSolved: false,
                    message: `Color ${color} does not have exactly two endpoints defined for checking.`,
                    type: "warning",
                };
            }
            const p1 = colorEndpoints[0];
            const p2 = colorEndpoints[1];
            const pathConnectsP1P2 = startCell.x === p1.x &&
                startCell.y === p1.y &&
                endCell.x === p2.x &&
                endCell.y === p2.y;
            const pathConnectsP2P1 = startCell.x === p2.x &&
                startCell.y === p2.y &&
                endCell.x === p1.x &&
                endCell.y === p1.y;
            if (!(pathConnectsP1P2 || pathConnectsP2P1)) {
                return {
                    isSolved: false,
                    message: `Path for color ${color} does not connect its designated endpoints.`,
                    type: "warning",
                };
            }
            for (const segment of pathInfo.segments) {
                const segmentKey = `${segment.x},${segment.y}`;
                if (allPathSegments.has(segmentKey)) {
                    return {
                        isSolved: false,
                        message: "Paths overlap.",
                        type: "warning",
                    };
                }
                allPathSegments.add(segmentKey);
            }
        }
        const totalGridCells = this.boardConfig.rows * this.boardConfig.cols;
        if (allPathSegments.size !== totalGridCells) {
            return {
                isSolved: false,
                message: `Not all grid cells are covered. Covered: ${allPathSegments.size}, Total: ${totalGridCells}`,
                type: "warning",
            };
        }
        return {
            isSolved: true,
            message: "Congratulations! Puzzle solved!",
            type: "success",
        };
    }
    handleCheckSolution() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSolvedState) {
                this.updateGameStatus("Board is already marked as solved. Save to persist.", false, "success");
                return;
            }
            const { isSolved, message, type } = this.checkSolutionLocally();
            this.updateGameStatus(message, false, type);
            if (isSolved) {
                this.isSolvedState = true;
                this.setUnsavedChanges(true); // Solved state is an unsaved change
            }
            else {
                // If check fails, and it was previously thought to be solved locally (e.g. from a bug or prior state)
                if (this.isSolvedState) {
                    this.isSolvedState = false;
                    this.setUnsavedChanges(true); // Change from solved to unsolved is an unsaved change.
                }
            }
            // updateButtonStatesAndIndicator is called by setUnsavedChanges
        });
    }
}
// --- DOMContentLoaded Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    const gameDataElement = document.getElementById("game-initial-data");
    const boardId = gameDataElement === null || gameDataElement === void 0 ? void 0 : gameDataElement.dataset.boardId;
    const csrf = gameDataElement === null || gameDataElement === void 0 ? void 0 : gameDataElement.dataset.csrfToken;
    if (boardId && csrf) {
        csrfToken = csrf;
        game = new FreeFlowGame(boardId, csrf);
    }
    else {
        console.error("Board ID or CSRF token not found or not replaced in DOM. Game cannot start.");
        const statusDiv = document.getElementById("game-status");
        if (statusDiv) {
            statusDiv.textContent = "Error: Game data missing. Cannot start.";
            statusDiv.className =
                "mb-4 p-3 text-center rounded transition-all duration-300 ease-in-out bg-red-100 text-red-700";
        }
    }
});
//# sourceMappingURL=play_game.js.map