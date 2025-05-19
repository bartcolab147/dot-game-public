interface BoardRendererOptions {
  containerId: string;
  gridId: string;
  svgId: string;
  routeNameSelector?: string;
}

export class BoardRenderer {
  private container: HTMLElement | null = null;
  private gridElement: HTMLElement | null = null;
  public svgElement: SVGSVGElement | null = null;
  private routeNameElement: HTMLElement | null = null;

  public rows: number = 5;
  public cols: number = 5;
  private pointsData: PointData[] = [];
  private _cellSize: number = 30; // Default

  constructor(options: BoardRendererOptions) {
    this.container = document.getElementById(options.containerId);
    this.gridElement = document.getElementById(options.gridId);
    this.svgElement = document.getElementById(
      options.svgId
    ) as SVGSVGElement | null;

    // Optional editor-specific elements
    if (options.routeNameSelector)
      this.routeNameElement = document.querySelector(options.routeNameSelector);

    if (!this.container || !this.gridElement || !this.svgElement) {
      console.error(
        "BoardRenderer: One or more critical rendering elements (container, grid, svg) are missing."
      );
    }

    window.addEventListener("resize", () => this.rebuildBoard());
  }

  public get cellSize(): number {
    return this._cellSize;
  }

  public getBoardDimensions(): { width: number; height: number } {
    if (this.cols === undefined || this.rows === undefined) {
      return { width: 0, height: 0 };
    }
    return {
      width: this.cols * this._cellSize,
      height: this.rows * this._cellSize,
    };
  }

  private calculateAndUpdateCellSize(): void {
    // Initial fallback values
    const defaultCellSize = 30;
    const minCellSize = 10;

    if (!this.container) {
      this._cellSize = (window as any).cellSize || defaultCellSize;
      (window as any).cellSize = this._cellSize;
      return;
    }

    const parent = this.container.parentElement as HTMLElement;
    if (!parent) {
      this._cellSize = (window as any).cellSize || defaultCellSize;
      (window as any).cellSize = this._cellSize;
      return;
    }

    const parentRect = parent.getBoundingClientRect();
    let effectiveAvailableWidth = parentRect.width;

    const sidebar = parent.querySelector(".max-w-md") as HTMLElement;
    const marginFromSidebar = 20; // Original margin value
    const verticalMargin = 200;

    if (sidebar) {
      const sidebarRect = sidebar.getBoundingClientRect();
      // Rough check for side-by-side layout
      const isSideBySide =
        sidebarRect.left >= parentRect.left + parentRect.width / 2 ||
        sidebarRect.right <= parentRect.left + parentRect.width / 2 ||
        (sidebarRect.top === parentRect.top &&
          sidebarRect.height === parentRect.height);

      if (isSideBySide && parentRect.width > sidebarRect.width) {
        // This subtraction assumes 'sidebar' takes space from 'parentRect.width'.
        effectiveAvailableWidth =
          parentRect.width - sidebarRect.width - marginFromSidebar;
      }
    }

    let cellSizeBasedOnWidth: number;
    if (this.cols > 0) {
      cellSizeBasedOnWidth = effectiveAvailableWidth / this.cols;
    } else {
      cellSizeBasedOnWidth = Infinity;
    }

    const effectiveAvailableHeight = window.innerHeight - verticalMargin;

    let cellSizeBasedOnHeight: number;
    if (this.rows > 0) {
      cellSizeBasedOnHeight = effectiveAvailableHeight / this.rows;
    } else {
      cellSizeBasedOnHeight = Infinity; // No height constraint if no rows
    }

    const potentialCellSize = Math.min(
      cellSizeBasedOnWidth,
      cellSizeBasedOnHeight
    );

    if (
      potentialCellSize === Infinity ||
      potentialCellSize <= 0 ||
      isNaN(potentialCellSize)
    ) {
      // Fallback if cols/rows are 0, or if calculated size is non-positive/NaN
      this._cellSize = (window as any).cellSize || defaultCellSize;
    } else {
      this._cellSize = Math.max(minCellSize, Math.floor(potentialCellSize));
    }

    (window as any).cellSize = this._cellSize; // Update global for compatibility
  }

  public rebuildBoard(
    newCols?: number,
    newRows?: number,
    newPoints?: PointData[]
  ): void {
    if (!this.container || !this.gridElement || !this.svgElement) {
      console.error(
        "BoardRenderer: Cannot build board, critical elements missing."
      );
      return;
    }

    if (newCols !== undefined) this.cols = newCols;
    if (newRows !== undefined) this.rows = newRows;
    if (newPoints !== undefined) this.pointsData = [...newPoints];

    if (this.cols === undefined || this.rows === undefined) {
      console.error(
        "BoardRenderer: Board dimensions (cols, rows) are undefined."
      );
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
    } else {
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

  public renderSinglePoint(point: PointData): SVGCircleElement | null {
    if (
      !this.svgElement ||
      this.cols === undefined ||
      this.rows === undefined ||
      this._cellSize <= 0
    )
      return null;

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.classList.add("point");
    if (point.id) circle.dataset.pointId = point.id.toString();
    circle.dataset.x = point.x.toString();
    circle.dataset.y = point.y.toString();
    circle.setAttribute("fill", point.color);
    this.svgElement.appendChild(circle);

    this.positionPointInGrid(circle, point.x, point.y);
    return circle;
  }

  public addPointToGrid(circle: SVGCircleElement, x: number, y: number): void {
    if (
      this.cols === undefined ||
      this.rows === undefined ||
      this._cellSize <= 0
    ) {
      console.error(
        "BoardRenderer: Board dimensions or cell size not valid, cannot add point to grid accurately."
      );
      return;
    }
    if (!this.svgElement || !this.svgElement.contains(circle)) {
      this.svgElement?.appendChild(circle);
    }
    this.positionPointInGrid(circle, x, y);
  }

  private positionPointInGrid(
    circle: SVGCircleElement,
    x: number,
    y: number
  ): void {
    if (
      this.cols === undefined ||
      this.rows === undefined ||
      this._cellSize <= 0
    )
      return;

    if (x > this.cols || y > this.rows || x < 1 || y < 1) {
      console.warn(
        `BoardRenderer: Point (${x},${y}) is out of bounds (${this.cols}x${this.rows}). Removing.`
      );
      circle.remove();
    } else {
      const radius = 0.3 * this._cellSize;
      circle.setAttribute("r", `${radius}`);
      circle.setAttribute(
        "cx",
        `${(x - 1) * this._cellSize + this._cellSize / 2}`
      );
      circle.setAttribute(
        "cy",
        `${(y - 1) * this._cellSize + this._cellSize / 2}`
      );
    }
  }

  public getRouteIdFromUrl(): string {
    const pathParts = window.location.pathname.split("/");
    const routeIdIndex = pathParts.indexOf("route") + 1;
    if (routeIdIndex > 0 && routeIdIndex < pathParts.length) {
      const routeId = pathParts[routeIdIndex];
      if (/^\d+$/.test(routeId)) return routeId;
    }

    const boardIdFromContainer = (
      this.container?.closest("[data-board-id]") as HTMLElement
    )?.dataset.boardId;
    if (boardIdFromContainer) return boardIdFromContainer;

    console.warn(
      "BoardRenderer: Could not determine route ID from URL or container dataset."
    );
    return "";
  }

  public async fetchBoardData(routeId: string): Promise<BoardData | null> {
    if (!routeId) {
      console.error("BoardRenderer: Route ID is required to fetch board data.");
      if (this.container)
        this.container.innerHTML =
          "<p class='text-red-500'>Error: Board ID not provided for data fetch.</p>";
      return null;
    }
    try {
      const response = await fetch(`/gallery/api/board/${routeId}/data/`);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to parse error JSON" }));
        throw new Error(
          `Fetch board data failed: ${response.status}. Server: ${
            errorData.error || "Unknown server error"
          }`
        );
      }
      const data: BoardData = await response.json();
      return data;
    } catch (error) {
      console.error("BoardRenderer: Error loading board data:", error);
      if (this.container)
        this.container.innerHTML = `<p class='text-red-500'>Error loading board data: ${
          (error as Error).message
        }.</p>`;
      return null;
    }
  }

  public async loadAndRenderBoard(routeIdParam?: string): Promise<void> {
    const routeId = routeIdParam || this.getRouteIdFromUrl();
    if (!routeId) {
      console.error(
        "BoardRenderer: Could not determine route ID for loading board."
      );
      if (this.container)
        this.container.innerHTML =
          "<p class='text-red-500'>Error: Board ID not found.</p>";
      this.rows = 0;
      this.cols = 0;
      this.pointsData = [];
      this.rebuildBoard(); // Render an empty/error state board
      return;
    }

    const data = await this.fetchBoardData(routeId);

    if (data) {
      this.rows = data.route.rows;
      this.cols = data.route.cols;
      this.pointsData = data.points;

      this.rebuildBoard(); // This will use the new rows/cols and pointsData

      (window as any).boardData = data;
      window.dispatchEvent(
        new CustomEvent<BoardData>("boardDataLoaded", { detail: data })
      );

      if (this.routeNameElement && data.route.name) {
        this.routeNameElement.textContent = data.route.name;
      }
    } else {
      // Error message handled by fetchBoardData or if routeId was missing.
      // Render an empty/error state board.
      this.rows = 0;
      this.cols = 0;
      this.pointsData = [];
      this.rebuildBoard();
    }
  }

  public getContainer(): HTMLElement | null {
    return this.container;
  }
}
