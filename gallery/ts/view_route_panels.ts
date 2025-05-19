class PanelManager {
  private togglePointsBtn: HTMLButtonElement | null;
  private toggleFormBtn: HTMLButtonElement | null;
  private toggleSettingsBtn: HTMLButtonElement | null;

  private pointsPanel: HTMLElement | null;
  private formPanel: HTMLElement | null;
  private settingsPanel: HTMLElement | null;

  private panels: { element: HTMLElement; name: string }[] = [];

  constructor() {
    this.togglePointsBtn = document.getElementById(
      "toggle-points"
    ) as HTMLButtonElement | null;
    this.toggleFormBtn = document.getElementById(
      "toggle-form"
    ) as HTMLButtonElement | null;
    this.toggleSettingsBtn = document.getElementById(
      "toggle-settings"
    ) as HTMLButtonElement | null;

    this.pointsPanel = document.getElementById(
      "points-panel"
    ) as HTMLElement | null;
    this.formPanel = document.getElementById(
      "form-panel"
    ) as HTMLElement | null;
    this.settingsPanel = document.getElementById(
      "settings-panel"
    ) as HTMLElement | null;

    if (
      !this.togglePointsBtn ||
      !this.toggleFormBtn ||
      !this.toggleSettingsBtn ||
      !this.pointsPanel ||
      !this.formPanel ||
      !this.settingsPanel
    ) {
      console.error(
        "PanelManager: One or more toggle buttons or panel elements are missing."
      );
      return;
    }

    this.panels = [
      { element: this.pointsPanel, name: "points" },
      { element: this.formPanel, name: "form" },
      { element: this.settingsPanel, name: "settings" },
    ];

    this.init();
  }

  private init(): void {
    this.setInitialPanelState();
    this.addEventListeners();
  }

  private hideAllPanels(): void {
    this.panels.forEach((p) => p.element.classList.add("hidden"));
  }

  private handleToggle(panelElement: HTMLElement, panelName: string): void {
    const isHidden = panelElement.classList.contains("hidden");
    this.hideAllPanels();

    if (isHidden) {
      panelElement.classList.remove("hidden");
      window.history.pushState({}, "", `?panel=${panelName}`);
    } else {
      window.history.pushState({}, "", window.location.pathname);
    }
  }

  private setInitialPanelState(): void {
    const params = new URLSearchParams(window.location.search);
    const panelToShowName = params.get("panel");

    this.hideAllPanels();

    const panelToActivate = this.panels.find((p) => p.name === panelToShowName);

    if (panelToActivate) {
      panelToActivate.element.classList.remove("hidden");
    } else {
      // Default to points panel if no specific panel or invalid panel in URL
      this.pointsPanel?.classList.remove("hidden");
    }
  }

  private addEventListeners(): void {
    this.togglePointsBtn?.addEventListener("click", () => {
      if (this.pointsPanel) this.handleToggle(this.pointsPanel, "points");
    });

    this.toggleFormBtn?.addEventListener("click", () => {
      if (this.formPanel) this.handleToggle(this.formPanel, "form");
    });

    this.toggleSettingsBtn?.addEventListener("click", () => {
      if (this.settingsPanel) this.handleToggle(this.settingsPanel, "settings");
    });

    // Optional: Listen to popstate to handle browser back/forward navigation
    window.addEventListener("popstate", () => this.setInitialPanelState());
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new PanelManager();
});
