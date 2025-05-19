// board_renderer.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class BoardRenderer {
    constructor(options) {
        this.container = null;
        this.gridElement = null;
        this.svgElement = null;
        this.xInput = null;
        this.yInput = null;
        this.pointsListUL = null;
        this.noPointsMessage = null;
        this.saveChangesButton = null;
        this.routeNameElement = null;
        this.rows = 5;
        this.cols = 5;
        this.pointsData = [];
        this._cellSize = 30; // Default
        // For compatibility with original script's fetchBoardDataAndRenderAll details
        this.autoSaveModeEnabled = false; // Not directly used by renderer, but fetched
        this.container = document.getElementById(options.containerId);
        this.gridElement = document.getElementById(options.gridId);
        this.svgElement = document.getElementById(options.svgId);
        // Optional editor-specific elements
        if (options.xInputId)
            this.xInput = document.getElementById(options.xInputId);
        if (options.yInputId)
            this.yInput = document.getElementById(options.yInputId);
        if (options.pointsListULId)
            this.pointsListUL = document.getElementById(options.pointsListULId);
        if (options.noPointsMessageId)
            this.noPointsMessage = document.getElementById(options.noPointsMessageId);
        if (options.saveChangesButtonId)
            this.saveChangesButton = document.getElementById(options.saveChangesButtonId);
        if (options.routeNameSelector)
            this.routeNameElement = document.querySelector(options.routeNameSelector);
        if (!this.container || !this.gridElement || !this.svgElement) {
            console.error("BoardRenderer: One or more critical rendering elements (container, grid, svg) are missing.");
            // Not throwing an error here, to allow partial setup if only some parts are used.
            // Methods using these elements will have to check.
        }
        window.addEventListener("resize", () => this.rebuildBoard());
    }
    get cellSize() {
        return this._cellSize;
    }
    getBoardDimensions() {
        if (this.cols === undefined || this.rows === undefined) {
            return { width: 0, height: 0 };
        }
        return {
            width: this.cols * this._cellSize,
            height: this.rows * this._cellSize,
        };
    }
    calculateAndUpdateCellSize() {
        if (!this.container) {
            this._cellSize = window.cellSize || 30; // Fallback
            return;
        }
        const parent = this.container.parentElement;
        if (!parent) {
            this._cellSize = window.cellSize || 30;
            return;
        }
        // This logic is from the original generate_grid.txt, may need adjustment
        // if sidebar structure is different or not present in all use cases.
        const sidebar = parent.querySelector(".max-w-md"); // Generic selector
        const margin = 20;
        const parentRect = parent.getBoundingClientRect();
        let availableWidth = parentRect.width;
        if (sidebar) {
            const sidebarRect = sidebar.getBoundingClientRect();
            // Check if sidebar is truly to the side and not stacked (e.g., on small screens)
            const isSideBySide = sidebarRect.left >= parentRect.left + parentRect.width / 2 || // Sidebar on the right
                sidebarRect.right <= parentRect.left + parentRect.width / 2 || // Sidebar on the left
                (sidebarRect.top === parentRect.top &&
                    sidebarRect.height === parentRect.height); // A rough check for side-by-side
            if (isSideBySide && parentRect.width > sidebarRect.width) {
                // Ensure sidebar isn't wider (responsive stacking)
                availableWidth = parentRect.width - sidebarRect.width - margin;
            }
        }
        if (this.cols > 0) {
            this._cellSize = Math.max(10, Math.floor(availableWidth / this.cols));
        }
        else {
            this._cellSize = window.cellSize || 30; // Fallback
        }
        window.cellSize = this._cellSize; // Update global for compatibility
    }
    rebuildBoard(newCols, newRows, newPoints) {
        if (!this.container || !this.gridElement || !this.svgElement) {
            console.error("BoardRenderer: Cannot build board, critical elements missing.");
            return;
        }
        if (newCols !== undefined)
            this.cols = newCols;
        if (newRows !== undefined)
            this.rows = newRows;
        if (newPoints !== undefined)
            this.pointsData = [...newPoints];
        if (this.cols === undefined || this.rows === undefined) {
            console.error("BoardRenderer: Board dimensions (cols, rows) are undefined.");
            return;
        }
        this.calculateAndUpdateCellSize();
        const { width, height } = this.getBoardDimensions();
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        this.gridElement.style.width = `${width}px`;
        this.gridElement.style.height = `${height}px`;
        this.gridElement.innerHTML = ""; // Clear old grid cells
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement("div");
                cell.style.width = `${this._cellSize}px`;
                cell.style.height = `${this._cellSize}px`;
                cell.style.border = "1px solid #ddd"; // Consider making style configurable
                cell.style.boxSizing = "border-box";
                this.gridElement.appendChild(cell);
            }
        }
        this.gridElement.style.display = "grid";
        this.gridElement.style.gridTemplateColumns = `repeat(${this.cols}, ${this._cellSize}px)`;
        this.gridElement.style.gridTemplateRows = `repeat(${this.rows}, ${this._cellSize}px)`;
        this.svgElement.setAttribute("width", `${width}`);
        this.svgElement.setAttribute("height", `${height}`);
        this.svgElement.style.width = `${width}px`;
        this.svgElement.style.height = `${height}px`;
        this.svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
        this.svgElement.innerHTML = ""; // Clear old SVG points
        this.pointsData.forEach((point) => {
            this.renderSinglePoint(point);
        });
    }
    renderSinglePoint(point) {
        if (!this.svgElement || this.cols === undefined || this.rows === undefined)
            return null;
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.classList.add("point"); // Keep class for potential styling/selection
        if (point.id)
            circle.dataset.pointId = point.id.toString();
        circle.dataset.x = point.x.toString();
        circle.dataset.y = point.y.toString();
        circle.setAttribute("fill", point.color);
        this.svgElement.appendChild(circle);
        this.positionPointInGrid(circle, point.x, point.y);
        return circle;
    }
    // This method matches the signature of the original global addPointToGrid
    addPointToGrid(circle, x, y) {
        var _a;
        if (this.cols === undefined || this.rows === undefined) {
            console.error("BoardRenderer: Board dimensions not set, cannot add point to grid accurately.");
            return;
        }
        if (!this.svgElement || !this.svgElement.contains(circle)) {
            // If circle is not in SVG, add it. This makes the method more robust.
            (_a = this.svgElement) === null || _a === void 0 ? void 0 : _a.appendChild(circle);
        }
        this.positionPointInGrid(circle, x, y);
    }
    positionPointInGrid(circle, x, y) {
        if (this.cols === undefined || this.rows === undefined)
            return;
        if (x > this.cols || y > this.rows || x < 1 || y < 1) {
            console.warn(`BoardRenderer: Point (${x},${y}) is out of bounds (${this.cols}x${this.rows}). Removing.`);
            circle.remove();
        }
        else {
            const radius = 0.3 * this._cellSize; // Consistent with original
            circle.setAttribute("r", `${radius}`);
            circle.setAttribute("cx", `${(x - 1) * this._cellSize + this._cellSize / 2}`);
            circle.setAttribute("cy", `${(y - 1) * this._cellSize + this._cellSize / 2}`);
        }
    }
    getRouteIdFromUrl() {
        var _a, _b;
        // Made public static if no `this` is needed, or instance method
        const pathParts = window.location.pathname.split("/");
        const routeIdIndex = pathParts.indexOf("route") + 1; // Assuming "route" is part of admin/editor URL
        if (routeIdIndex > 0 && routeIdIndex < pathParts.length) {
            const routeId = pathParts[routeIdIndex];
            if (/^\d+$/.test(routeId))
                return routeId;
        }
        // Fallback for cases where URL doesn't contain ID like '/route/<id>/'
        // E.g., if ID is in a data attribute on the container this renderer manages
        const boardIdFromContainer = (_b = (_a = this.container) === null || _a === void 0 ? void 0 : _a.closest("[data-board-id]")) === null || _b === void 0 ? void 0 : _b.dataset.boardId;
        if (boardIdFromContainer)
            return boardIdFromContainer;
        console.warn("BoardRenderer: Could not determine route ID from URL, trying container dataset.");
        return "";
    }
    fetchBoardData(routeId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!routeId) {
                console.error("BoardRenderer: Route ID is required to fetch board data.");
                if (this.container)
                    this.container.innerHTML =
                        "<p class='text-red-500'>Error: Board ID not provided for data fetch.</p>";
                return null;
            }
            try {
                const response = yield fetch(`/gallery/api/board/${routeId}/data/`); // Ensure this API endpoint is correct
                if (!response.ok) {
                    const errorData = yield response
                        .json()
                        .catch(() => ({ error: "Failed to parse error JSON" }));
                    throw new Error(`Fetch board data failed: ${response.status}. Server: ${errorData.error || "Unknown server error"}`);
                }
                const data = yield response.json();
                return data;
            }
            catch (error) {
                console.error("BoardRenderer: Error loading board data:", error);
                if (this.container)
                    this.container.innerHTML = `<p class='text-red-500'>Error loading board data: ${error.message}.</p>`;
                return null;
            }
        });
    }
    loadAndRenderBoard(routeIdParam) {
        return __awaiter(this, void 0, void 0, function* () {
            const routeId = routeIdParam || this.getRouteIdFromUrl();
            if (!routeId) {
                console.error("BoardRenderer: Could not determine route ID for loading board.");
                if (this.container)
                    this.container.innerHTML =
                        "<p class='text-red-500'>Error: Board ID not found.</p>";
                return;
            }
            const data = yield this.fetchBoardData(routeId);
            if (data) {
                this.rows = data.route.rows;
                this.cols = data.route.cols;
                this.pointsData = data.points;
                this.autoSaveModeEnabled = data.route.auto_save_enabled; // Stored for compatibility
                window.boardData = data; // Expose globally as in original
                window.dispatchEvent(new CustomEvent("boardDataLoaded", { detail: data }));
                if (this.routeNameElement && data.route.name) {
                    this.routeNameElement.textContent = data.route.name;
                }
                // The original script had pendingChanges.length = 0; here.
                // If this renderer manages such state, it should be handled.
                // For now, assuming pendingChanges is external or for editor-specific logic.
                this.rebuildBoard();
            }
            else {
                // Error message already shown by fetchBoardData or if routeId was missing
                // Optionally, render a default or empty board state
                this.pointsData = [];
                this.rebuildBoard(); // Render an empty board or default
            }
        });
    }
}
// Example of how this class might be instantiated and globally exposed (similar to original script)
// This part would typically be in the main script file that sets up the page.
// For demonstration, included here. Remove if instantiation happens elsewhere.
/*
window.addEventListener("DOMContentLoaded", () => {
  const boardRenderer = new BoardRenderer({
    containerId: "dotBoard",
    gridId: "board-grid",
    svgId: "overlay-svg",
    xInputId: "id_x", // Optional: only if this is an editor page
    yInputId: "id_y", // Optional
    pointsListULId: "points-list-ul", // Optional
    noPointsMessageId: "no-points-message", // Optional
    // saveChangesButtonId: "save-board-button", // Optional
    routeNameSelector: "h1.text-3xl" // Optional
  });

  // Expose methods on window object for compatibility or external calls
  (window as any).boardRendererInstance = boardRenderer; // For direct access to instance
  (window as any).buildBoard = boardRenderer.rebuildBoard.bind(boardRenderer);
  (window as any).addPointToGrid = boardRenderer.addPointToGrid.bind(boardRenderer);
  (window as any).fetchBoardDataAndRenderAll = boardRenderer.loadAndRenderBoard.bind(boardRenderer);

  // Automatically load data if the script is for a page that should display a board by default
  // This check might be more specific, e.g., if a certain element exists.
  if (document.getElementById("dotBoard")) {
    boardRenderer.loadAndRenderBoard();
  }
});
*/
//# sourceMappingURL=generate_grid.js.map