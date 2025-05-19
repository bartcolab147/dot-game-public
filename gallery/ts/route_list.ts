// static/ts/gallery/route_list.ts

interface BoardGame {
  id: number;
  name: string;
  user_id: number;
  creator_username: string;
  background_image_url: string | null;
  rows: number;
  cols: number;
  view_url: string;
  delete_url?: string; // Optional, only for user's own boards
}

interface BackgroundImage {
  id: number;
  name: string;
  image_url: string | null;
}

interface ApiConfig {
  myBoardsUrl: string;
  playableBoardsUrl: string;
  backgroundsUrl: string;
  createBoardUrl: string;
  viewRouteUrlBase: string;
  deleteBoardApiUrlBase: string; // This is the URL template with '/0/'
}

class RouteListManager {
  private config: ApiConfig;
  private csrfToken: string;

  // Create Board Modal Elements (same as before)
  private createBoardModal: HTMLElement;
  private showCreateBoardModalBtn: HTMLElement;
  private closeCreateModalBtnX: HTMLElement;
  private cancelCreateBoardBtn: HTMLElement;
  private createBoardForm: HTMLFormElement;
  private backgroundImageSelector: HTMLElement;
  private selectedBackgroundIdInput: HTMLInputElement;
  private backgroundsLoadingIndicator: HTMLElement;
  private backgroundSelectionError: HTMLElement;
  private createBoardError: HTMLElement;
  private submitCreateBoardBtn: HTMLButtonElement;

  // Delete Confirm Modal Elements (same as before)
  private deleteConfirmModal: HTMLElement;
  private cancelDeleteBtn: HTMLElement;
  private confirmDeleteBtn: HTMLButtonElement;
  private deleteConfirmMessage: HTMLElement;
  private deleteBoardError: HTMLElement;
  private boardIdToDelete: number | null = null;

  // Board Containers and Search
  private myBoardsCarousel: HTMLElement;
  private playableBoardsCarousel: HTMLElement;
  private myBoardsLoading: HTMLElement;
  private playableBoardsLoading: HTMLElement;
  private myBoardsEmpty: HTMLElement;
  private playableBoardsEmpty: HTMLElement;
  private myBoardsSearchInput: HTMLInputElement;
  private playableBoardsSearchInput: HTMLInputElement;

  // Data stores
  private allMyBoards: BoardGame[] = [];
  private allPlayableBoards: BoardGame[] = [];

  constructor() {
    const configElement = document.getElementById("js-config");
    if (!configElement) throw new Error("JS Config element not found");

    this.config = {
      myBoardsUrl: configElement.dataset.apiMyBoardsUrl!,
      playableBoardsUrl: configElement.dataset.apiPlayableBoardsUrl!,
      backgroundsUrl: configElement.dataset.apiBackgroundsUrl!,
      createBoardUrl: configElement.dataset.apiCreateBoardUrl!,
      viewRouteUrlBase: configElement.dataset.viewRouteUrlBase!.replace(
        // This one is fine if used by appending ID
        "/0/",
        "/"
      ),
      // MODIFICATION 1: Keep the /0/ placeholder in deleteBoardApiUrlBase
      deleteBoardApiUrlBase: configElement.dataset.deleteBoardApiUrlBase!, // Removed .replace("/0/", "/")
    };

    const csrfContainer = document.getElementById("csrf-token-container");
    const csrfInput = csrfContainer?.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    ) as HTMLInputElement;
    this.csrfToken = csrfInput?.value || "";

    // Initialize DOM elements
    this.createBoardModal = document.getElementById("create-board-modal")!;
    this.showCreateBoardModalBtn = document.getElementById(
      "show-create-board-modal-btn"
    )!;
    this.closeCreateModalBtnX = document.getElementById(
      "close-create-modal-btn-x"
    )!;
    this.cancelCreateBoardBtn = document.getElementById(
      "cancel-create-board-btn"
    )!;
    this.createBoardForm = document.getElementById(
      "create-board-form"
    ) as HTMLFormElement;
    this.backgroundImageSelector = document.getElementById(
      "background-image-selector"
    )!;
    this.selectedBackgroundIdInput = document.getElementById(
      "selected-background-id"
    ) as HTMLInputElement;
    this.backgroundsLoadingIndicator = document.getElementById(
      "backgrounds-loading"
    )!;
    this.backgroundSelectionError = document.getElementById(
      "background-selection-error"
    )!;
    this.createBoardError = document.getElementById("create-board-error")!;
    this.submitCreateBoardBtn = document.getElementById(
      "submit-create-board-btn"
    ) as HTMLButtonElement;

    this.deleteConfirmModal = document.getElementById("delete-confirm-modal")!;
    this.cancelDeleteBtn = document.getElementById("cancel-delete-btn")!;
    this.confirmDeleteBtn = document.getElementById(
      "confirm-delete-btn"
    ) as HTMLButtonElement;
    this.deleteConfirmMessage = document.getElementById(
      "delete-confirm-message"
    )!;
    this.deleteBoardError = document.getElementById("delete-board-error")!;

    this.myBoardsCarousel = document.getElementById("my-boards-carousel")!;
    this.playableBoardsCarousel = document.getElementById(
      "playable-boards-carousel"
    )!;
    this.myBoardsLoading = document.getElementById("my-boards-loading")!;
    this.playableBoardsLoading = document.getElementById(
      "playable-boards-loading"
    )!;
    this.myBoardsEmpty = document.getElementById("my-boards-empty")!;
    this.playableBoardsEmpty = document.getElementById(
      "playable-boards-empty"
    )!;
    this.myBoardsSearchInput = document.getElementById(
      "my-boards-search"
    ) as HTMLInputElement;
    this.playableBoardsSearchInput = document.getElementById(
      "playable-boards-search"
    ) as HTMLInputElement;

    this.initEventListeners();
    this.loadInitialData();
  }

  private initEventListeners(): void {
    this.showCreateBoardModalBtn.addEventListener("click", () =>
      this.openCreateBoardModal()
    );
    this.closeCreateModalBtnX.addEventListener("click", () =>
      this.closeCreateBoardModal()
    );
    this.cancelCreateBoardBtn.addEventListener("click", () =>
      this.closeCreateBoardModal()
    );
    this.createBoardForm.addEventListener("submit", (e) =>
      this.handleCreateBoardSubmit(e)
    );

    this.cancelDeleteBtn.addEventListener("click", () =>
      this.closeDeleteConfirmModal()
    );
    this.confirmDeleteBtn.addEventListener("click", () =>
      this.handleConfirmDelete()
    );

    this.myBoardsSearchInput.addEventListener("input", () =>
      this.filterMyBoards()
    );
    this.playableBoardsSearchInput.addEventListener("input", () =>
      this.filterPlayableBoards()
    );
  }

  private async fetchApi<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": this.csrfToken,
        ...options.headers,
      },
      ...options,
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }
    return response.json() as Promise<T>;
  }

  private async loadInitialData(): Promise<void> {
    this.loadMyBoards();
    this.loadPlayableBoards();
  }

  private async loadMyBoards(): Promise<void> {
    this.myBoardsLoading.style.display = "block";
    this.myBoardsCarousel.innerHTML = ""; // Clear previous items
    this.myBoardsEmpty.style.display = "none";
    try {
      this.allMyBoards = await this.fetchApi<BoardGame[]>(
        this.config.myBoardsUrl
      );
      this.filterMyBoards(); // Apply current search or render all
    } catch (error) {
      console.error("Failed to load user's boards:", error);
      this.myBoardsCarousel.innerHTML = `<p class="text-red-500 py-4">Error loading your boards.</p>`;
    } finally {
      this.myBoardsLoading.style.display = "none";
    }
  }

  private async loadPlayableBoards(): Promise<void> {
    this.playableBoardsLoading.style.display = "block";
    this.playableBoardsCarousel.innerHTML = ""; // Clear previous items
    this.playableBoardsEmpty.style.display = "none";
    try {
      this.allPlayableBoards = await this.fetchApi<BoardGame[]>(
        this.config.playableBoardsUrl
      );
      this.filterPlayableBoards(); // Apply current search or render all
    } catch (error) {
      console.error("Failed to load playable boards:", error);
      this.playableBoardsCarousel.innerHTML = `<p class="text-red-500 py-4">Error loading games.</p>`;
    } finally {
      this.playableBoardsLoading.style.display = "none";
    }
  }

  private filterMyBoards(): void {
    const searchTerm = this.myBoardsSearchInput.value.toLowerCase();
    const filteredBoards = this.allMyBoards.filter((board) =>
      board.name.toLowerCase().includes(searchTerm)
    );
    this.renderBoards(
      filteredBoards,
      this.myBoardsCarousel,
      this.myBoardsEmpty,
      true
    );
  }

  private filterPlayableBoards(): void {
    const searchTerm = this.playableBoardsSearchInput.value.toLowerCase();
    const filteredBoards = this.allPlayableBoards.filter((board) =>
      board.name.toLowerCase().includes(searchTerm)
    );
    this.renderBoards(
      filteredBoards,
      this.playableBoardsCarousel,
      this.playableBoardsEmpty,
      false
    );
  }

  private renderBoards(
    boards: BoardGame[],
    carouselElement: HTMLElement,
    emptyMessageElement: HTMLElement,
    isEditable: boolean
  ): void {
    carouselElement.innerHTML = ""; // Clear previous content

    if (boards.length === 0) {
      emptyMessageElement.style.display = "block";
      return;
    }
    emptyMessageElement.style.display = "none";

    boards.forEach((board) => {
      const cardWrapper = document.createElement("div");
      cardWrapper.className = "board-card-carousel-item";

      const card = document.createElement("div");
      card.className =
        "relative bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow h-60 flex flex-col justify-between w-full";

      const backgroundDiv = document.createElement("div");
      backgroundDiv.className =
        "w-full h-32 bg-cover bg-center rounded-t-lg mb-2";
      if (board.background_image_url) {
        backgroundDiv.style.backgroundImage = `url('${board.background_image_url}')`;
      } else {
        backgroundDiv.classList.add("bg-gray-200");
      }

      const nameSpan = document.createElement("span");
      nameSpan.className =
        "text-lg font-medium break-words text-center flex-1 flex items-center justify-center w-full";
      nameSpan.textContent = board.name;

      const infoDiv = document.createElement("div");
      infoDiv.className = "text-xs text-gray-500 text-center mt-1";
      infoDiv.textContent = `By: ${board.creator_username} | ${board.rows}x${board.cols}`;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "mt-3 flex justify-center space-x-2";

      const playOrEditLink = document.createElement("a");
      playOrEditLink.href = board.view_url;
      playOrEditLink.className =
        "bg-blue-500 text-white py-1 px-3 rounded-md hover:bg-blue-600 transition-all text-sm";
      playOrEditLink.textContent = isEditable ? "Edit" : "Play";

      actionsDiv.appendChild(playOrEditLink);

      card.appendChild(backgroundDiv);
      card.appendChild(nameSpan);
      card.appendChild(infoDiv);
      card.appendChild(actionsDiv);

      if (isEditable && board.delete_url) {
        // Note: board.delete_url is not used for actual deletion API call path currently
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "board-card-delete-btn";
        deleteBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>`;
        deleteBtn.title = "Delete board";
        deleteBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openDeleteConfirmModal(board.id, board.name);
        });
        card.appendChild(deleteBtn);
      }
      cardWrapper.appendChild(card);
      carouselElement.appendChild(cardWrapper);
    });
  }

  // --- Create Board Modal Methods (largely same as before) ---
  private async openCreateBoardModal(): Promise<void> {
    this.createBoardForm.reset();
    this.selectedBackgroundIdInput.value = "";
    this.clearBackgroundSelection();
    this.createBoardError.classList.add("hidden");
    this.createBoardError.textContent = "";
    this.backgroundSelectionError.classList.add("hidden");

    this.createBoardModal.classList.remove("hidden");
    this.loadBackgroundImages();
  }

  private closeCreateBoardModal(): void {
    this.createBoardModal.classList.add("hidden");
  }

  private async loadBackgroundImages(): Promise<void> {
    this.backgroundImageSelector.innerHTML = "";
    this.backgroundsLoadingIndicator.style.display = "block";
    this.backgroundImageSelector.appendChild(this.backgroundsLoadingIndicator);

    try {
      const backgrounds = await this.fetchApi<BackgroundImage[]>(
        this.config.backgroundsUrl
      );
      this.backgroundsLoadingIndicator.style.display = "none";
      if (backgrounds.length === 0) {
        this.backgroundImageSelector.innerHTML =
          '<p class="text-gray-500 col-span-full text-center py-4">No background images available.</p>';
        return;
      }
      backgrounds.forEach((bg) => {
        const thumbDiv = document.createElement("div");
        thumbDiv.className = "bg-image-thumbnail";
        if (bg.image_url) {
          thumbDiv.style.backgroundImage = `url('${bg.image_url}')`;
        } else {
          thumbDiv.classList.add("bg-gray-300");
          thumbDiv.textContent = bg.name.substring(0, 3);
          thumbDiv.classList.add(
            "flex",
            "items-center",
            "justify-center",
            "text-xs",
            "text-gray-600"
          );
        }
        thumbDiv.title = bg.name;
        thumbDiv.dataset.bgId = bg.id.toString();
        thumbDiv.addEventListener("click", () =>
          this.selectBackground(bg.id, thumbDiv)
        );
        this.backgroundImageSelector.appendChild(thumbDiv);
      });
    } catch (error) {
      console.error("Failed to load background images:", error);
      this.backgroundImageSelector.innerHTML =
        '<p class="text-red-500 col-span-full text-center py-4">Error loading backgrounds.</p>';
    }
  }

  private selectBackground(bgId: number, selectedThumbDiv: HTMLElement): void {
    this.selectedBackgroundIdInput.value = bgId.toString();
    this.backgroundSelectionError.classList.add("hidden");
    this.clearBackgroundSelection();
    selectedThumbDiv.classList.add("selected-background");
  }

  private clearBackgroundSelection(): void {
    const allThumbs = this.backgroundImageSelector.querySelectorAll(
      ".bg-image-thumbnail"
    );
    allThumbs.forEach((thumb) => thumb.classList.remove("selected-background"));
  }

  private async handleCreateBoardSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.createBoardError.classList.add("hidden");
    this.createBoardError.textContent = "";
    this.submitCreateBoardBtn.disabled = true;
    this.submitCreateBoardBtn.textContent = "Creating...";

    const formData = new FormData(this.createBoardForm);
    const name = formData.get("name") as string;
    const rows = parseInt(formData.get("rows") as string, 10);
    const cols = parseInt(formData.get("cols") as string, 10);
    const backgroundId = this.selectedBackgroundIdInput.value;

    if (!backgroundId) {
      this.backgroundSelectionError.textContent =
        "Please select a background image.";
      this.backgroundSelectionError.classList.remove("hidden");
      this.submitCreateBoardBtn.disabled = false;
      this.submitCreateBoardBtn.textContent = "Create Board";
      return;
    }
    this.backgroundSelectionError.classList.add("hidden");

    try {
      const newBoard = await this.fetchApi<BoardGame>(
        this.config.createBoardUrl,
        {
          method: "POST",
          body: JSON.stringify({
            name: name,
            rows: rows,
            cols: cols,
            background_id: parseInt(backgroundId, 10),
          }),
        }
      );
      this.closeCreateBoardModal();
      this.myBoardsSearchInput.value = "";
      this.loadMyBoards();
    } catch (error: any) {
      this.createBoardError.textContent =
        error.message || "Failed to create board.";
      this.createBoardError.classList.remove("hidden");
    } finally {
      this.submitCreateBoardBtn.disabled = false;
      this.submitCreateBoardBtn.textContent = "Create Board";
    }
  }

  // --- Delete Board Modal Methods (same as before, except URL construction) ---
  private openDeleteConfirmModal(boardId: number, boardName: string): void {
    this.boardIdToDelete = boardId;
    this.deleteConfirmMessage.textContent = `Are you sure you want to delete the board "${boardName}"? This action cannot be undone.`;
    this.deleteBoardError.classList.add("hidden");
    this.deleteBoardError.textContent = "";
    this.deleteConfirmModal.classList.remove("hidden");
  }

  private closeDeleteConfirmModal(): void {
    this.deleteConfirmModal.classList.add("hidden");
    this.boardIdToDelete = null;
  }

  private async handleConfirmDelete(): Promise<void> {
    if (this.boardIdToDelete === null) return;

    this.confirmDeleteBtn.disabled = true;
    this.confirmDeleteBtn.textContent = "Deleting...";
    this.deleteBoardError.classList.add("hidden");

    // MODIFICATION 2: Construct deleteUrl by replacing the placeholder
    const deleteUrl = this.config.deleteBoardApiUrlBase.replace(
      "/0/", // The placeholder from the Django {% url ... 0 %} tag
      `/${this.boardIdToDelete}/`
    );

    try {
      await this.fetchApi<{ status: string; message: string }>(deleteUrl, {
        method: "DELETE",
      });
      this.closeDeleteConfirmModal();
      this.loadMyBoards();
    } catch (error: any) {
      this.deleteBoardError.textContent =
        error.message || "Failed to delete board.";
      this.deleteBoardError.classList.remove("hidden");
    } finally {
      this.confirmDeleteBtn.disabled = false;
      this.confirmDeleteBtn.textContent = "Delete";
    }
  }
}

// Initialize the manager once the DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new RouteListManager();
});
