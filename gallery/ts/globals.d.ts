// globals.d.ts
declare global {
  interface PointData {
    id: number | string;
    x: number;
    y: number;
    color: string;
  }

  interface BoardRouteData {
    // Added for clarity, matching play_game.ts
    id: number;
    name: string;
    rows: number;
    cols: number;
    auto_save_enabled: boolean;
  }

  interface BoardData {
    route: BoardRouteData;
    points: PointData[];
  }

  // Context interface for dependency injection into editor components
  interface IRouteEditorContext {
    // Board and Data Access
    getBoardId: () => string | null;
    getCsrfToken: () => string;
    getBoardData: () => BoardData | undefined;
    getCurrentPointsData: () => PointData[];
    getPendingChanges: () => any[];
    isAutoSaveMode: () => boolean;
    getCellSize: () => number; // From BoardRenderer

    // Data Mutation (affecting boardData or pendingChanges in the main app)
    updateBoardNameInState: (name: string) => void;
    updateBoardDimensionsInState: (cols: number, rows: number) => void;
    setBoardAutoSaveFlagInState: (enabled: boolean) => void;
    addPendingChange: (change: any) => void;
    findAndModifyPendingChange: (
      predicate: (op: any) => boolean,
      modifyFn: (op: any) => void
    ) => boolean;
    clearPendingChanges: () => void;
    setCurrentPointsData: (points: PointData[]) => void; // For after save
    removePointsByColorFromState: (color: string) => PointData[]; // Removes from currentPointsData, returns removed
    removePointByIdFromState: (pointId: string) => PointData | undefined; // Removes specific point by ID

    // UI and Interaction
    updatePageTitle: (name: string) => void;
    updateSaveChangesButtonState: () => void;
    rebuildBoardVisuals: (
      cols?: number,
      rows?: number,
      points?: PointData[]
    ) => void;
    fetchBoardDataAndRenderAll: () => Promise<void>; // Full refresh from server
    highlightPointOnBoard: (
      x: number,
      y: number,
      color: string,
      isTemporary?: boolean
    ) => void;
    addPointToSvgGrid: (
      // From BoardRenderer
      circle: SVGCircleElement,
      x: number,
      y: number
    ) => void;
    removePointFromSvgGrid: (pointId: string) => void;
    enablePointDragging: () => void;
    refreshPointsListDisplay: () => void;
    isCellOccupiedOnBoard: (x: number, y: number) => boolean;
    isColorInUseOnBoard: (color: string) => boolean;

    // For PointAdder specific UI
    updatePointAdderStatus: (message: string, isError?: boolean) => void;
    getSvgElement: () => SVGSVGElement | null; // For PointAdder to attach listeners

    addPointsToStateAndPending: (
      pointsData: PointData[],
      addOperation: any
    ) => void;
  }

  interface WindowEventMap {
    boardDataLoaded: CustomEvent<BoardData>; // Emitted by BoardRenderer
    autoSaveModeChanged: CustomEvent<{ auto_save_enabled: boolean }>; // Emitted from settings panel
  }

  interface Window {
    cellSize?: number;
    // BoardRenderer instance might still be exposed by itself, or managed by RouteEditorApp.
    // For this refactor, we assume RouteEditorApp manages interactions with it.
    boardRendererInstance?: any; // Keeping for now if BoardRenderer still exposes itself.

    // Try to minimize these. If RouteEditorApp is the main controller,
    // these might not be needed or could be namespaced under a single app object.
    // For this refactor, we aim to remove direct reliance on these from sub-modules.
    // getRouteIdFromUrl?: () => string; // Now on BoardRenderer, accessed via context
    // getCsrfToken?: () => string; // Accessed via context
  }
}

export {}; // Make this a module
