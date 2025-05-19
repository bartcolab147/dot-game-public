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
        this.routeNameElement = null;
        this.rows = 5;
        this.cols = 5;
        this.pointsData = [];
        this._cellSize = 30; // Default
        this.container = document.getElementById(options.containerId);
        this.gridElement = document.getElementById(options.gridId);
        this.svgElement = document.getElementById(options.svgId);
        // Optional editor-specific elements
        if (options.routeNameSelector)
            this.routeNameElement = document.querySelector(options.routeNameSelector);
        if (!this.container || !this.gridElement || !this.svgElement) {
            console.error("BoardRenderer: One or more critical rendering elements (container, grid, svg) are missing.");
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
        // Initial fallback values
        const defaultCellSize = 30;
        const minCellSize = 10;
        if (!this.container) {
            this._cellSize = window.cellSize || defaultCellSize;
            window.cellSize = this._cellSize;
            return;
        }
        const parent = this.container.parentElement;
        if (!parent) {
            this._cellSize = window.cellSize || defaultCellSize;
            window.cellSize = this._cellSize;
            return;
        }
        const parentRect = parent.getBoundingClientRect();
        let effectiveAvailableWidth = parentRect.width;
        const sidebar = parent.querySelector(".max-w-md");
        const marginFromSidebar = 20; // Original margin value
        const verticalMargin = 200;
        if (sidebar) {
            const sidebarRect = sidebar.getBoundingClientRect();
            // Rough check for side-by-side layout
            const isSideBySide = sidebarRect.left >= parentRect.left + parentRect.width / 2 ||
                sidebarRect.right <= parentRect.left + parentRect.width / 2 ||
                (sidebarRect.top === parentRect.top &&
                    sidebarRect.height === parentRect.height);
            if (isSideBySide && parentRect.width > sidebarRect.width) {
                // This subtraction assumes 'sidebar' takes space from 'parentRect.width'.
                effectiveAvailableWidth =
                    parentRect.width - sidebarRect.width - marginFromSidebar;
            }
        }
        let cellSizeBasedOnWidth;
        if (this.cols > 0) {
            cellSizeBasedOnWidth = effectiveAvailableWidth / this.cols;
        }
        else {
            cellSizeBasedOnWidth = Infinity;
        }
        const effectiveAvailableHeight = window.innerHeight - verticalMargin;
        let cellSizeBasedOnHeight;
        if (this.rows > 0) {
            cellSizeBasedOnHeight = effectiveAvailableHeight / this.rows;
        }
        else {
            cellSizeBasedOnHeight = Infinity; // No height constraint if no rows
        }
        const potentialCellSize = Math.min(cellSizeBasedOnWidth, cellSizeBasedOnHeight);
        if (potentialCellSize === Infinity ||
            potentialCellSize <= 0 ||
            isNaN(potentialCellSize)) {
            // Fallback if cols/rows are 0, or if calculated size is non-positive/NaN
            this._cellSize = window.cellSize || defaultCellSize;
        }
        else {
            this._cellSize = Math.max(minCellSize, Math.floor(potentialCellSize));
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
            // Optionally render an empty state or return
            this.cols = this.cols === undefined ? 0 : this.cols;
            this.rows = this.rows === undefined ? 0 : this.rows;
            // Fallback to rendering an empty board if dimensions were initially undefined
        }
        this.calculateAndUpdateCellSize(); // This will set _cellSize
        const { width, height } = this.getBoardDimensions();
        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        this.gridElement.style.width = `${width}px`;
        this.gridElement.style.height = `${height}px`;
        this.gridElement.innerHTML = ""; // Clear old grid cells
        // Only create grid cells if dimensions are valid
        if (this.rows > 0 && this.cols > 0 && this._cellSize > 0) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = document.createElement("div");
                    cell.style.width = `${this._cellSize}px`;
                    cell.style.height = `${this._cellSize}px`;
                    cell.style.border = "1px solid #ddd";
                    cell.style.boxSizing = "border-box";
                    this.gridElement.appendChild(cell);
                }
            }
            this.gridElement.style.display = "grid";
            this.gridElement.style.gridTemplateColumns = `repeat(${this.cols}, ${this._cellSize}px)`;
            this.gridElement.style.gridTemplateRows = `repeat(${this.rows}, ${this._cellSize}px)`;
        }
        else {
            // Handle case of zero dimensions or cell size
            this.gridElement.style.display = "none"; // Or some other placeholder style
        }
        this.svgElement.setAttribute("width", `${width}`);
        this.svgElement.setAttribute("height", `${height}`);
        this.svgElement.style.width = `${width}px`;
        this.svgElement.style.height = `${height}px`;
        this.svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);
        this.svgElement.innerHTML = ""; // Clear old SVG points
        if (this.rows > 0 && this.cols > 0 && this._cellSize > 0) {
            this.pointsData.forEach((point) => {
                this.renderSinglePoint(point);
            });
        }
    }
    renderSinglePoint(point) {
        if (!this.svgElement ||
            this.cols === undefined ||
            this.rows === undefined ||
            this._cellSize <= 0)
            return null;
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.classList.add("point");
        if (point.id)
            circle.dataset.pointId = point.id.toString();
        circle.dataset.x = point.x.toString();
        circle.dataset.y = point.y.toString();
        circle.setAttribute("fill", point.color);
        this.svgElement.appendChild(circle);
        this.positionPointInGrid(circle, point.x, point.y);
        return circle;
    }
    addPointToGrid(circle, x, y) {
        var _a;
        if (this.cols === undefined ||
            this.rows === undefined ||
            this._cellSize <= 0) {
            console.error("BoardRenderer: Board dimensions or cell size not valid, cannot add point to grid accurately.");
            return;
        }
        if (!this.svgElement || !this.svgElement.contains(circle)) {
            (_a = this.svgElement) === null || _a === void 0 ? void 0 : _a.appendChild(circle);
        }
        this.positionPointInGrid(circle, x, y);
    }
    positionPointInGrid(circle, x, y) {
        if (this.cols === undefined ||
            this.rows === undefined ||
            this._cellSize <= 0)
            return;
        if (x > this.cols || y > this.rows || x < 1 || y < 1) {
            console.warn(`BoardRenderer: Point (${x},${y}) is out of bounds (${this.cols}x${this.rows}). Removing.`);
            circle.remove();
        }
        else {
            const radius = 0.3 * this._cellSize;
            circle.setAttribute("r", `${radius}`);
            circle.setAttribute("cx", `${(x - 1) * this._cellSize + this._cellSize / 2}`);
            circle.setAttribute("cy", `${(y - 1) * this._cellSize + this._cellSize / 2}`);
        }
    }
    getRouteIdFromUrl() {
        var _a, _b;
        const pathParts = window.location.pathname.split("/");
        const routeIdIndex = pathParts.indexOf("route") + 1;
        if (routeIdIndex > 0 && routeIdIndex < pathParts.length) {
            const routeId = pathParts[routeIdIndex];
            if (/^\d+$/.test(routeId))
                return routeId;
        }
        const boardIdFromContainer = (_b = (_a = this.container) === null || _a === void 0 ? void 0 : _a.closest("[data-board-id]")) === null || _b === void 0 ? void 0 : _b.dataset.boardId;
        if (boardIdFromContainer)
            return boardIdFromContainer;
        console.warn("BoardRenderer: Could not determine route ID from URL or container dataset.");
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
                const response = yield fetch(`/gallery/api/board/${routeId}/data/`);
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
                this.rows = 0;
                this.cols = 0;
                this.pointsData = [];
                this.rebuildBoard(); // Render an empty/error state board
                return;
            }
            const data = yield this.fetchBoardData(routeId);
            if (data) {
                this.rows = data.route.rows;
                this.cols = data.route.cols;
                this.pointsData = data.points;
                this.rebuildBoard(); // This will use the new rows/cols and pointsData
                window.boardData = data;
                window.dispatchEvent(new CustomEvent("boardDataLoaded", { detail: data }));
                if (this.routeNameElement && data.route.name) {
                    this.routeNameElement.textContent = data.route.name;
                }
            }
            else {
                // Error message handled by fetchBoardData or if routeId was missing.
                // Render an empty/error state board.
                this.rows = 0;
                this.cols = 0;
                this.pointsData = [];
                this.rebuildBoard();
            }
        });
    }
    getContainer() {
        return this.container;
    }
}
//# sourceMappingURL=board_renderer.js.map