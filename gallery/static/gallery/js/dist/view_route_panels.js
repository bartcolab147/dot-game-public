"use strict";
class PanelManager {
    constructor() {
        this.panels = [];
        this.togglePointsBtn = document.getElementById("toggle-points");
        this.toggleFormBtn = document.getElementById("toggle-form");
        this.toggleSettingsBtn = document.getElementById("toggle-settings");
        this.pointsPanel = document.getElementById("points-panel");
        this.formPanel = document.getElementById("form-panel");
        this.settingsPanel = document.getElementById("settings-panel");
        if (!this.togglePointsBtn ||
            !this.toggleFormBtn ||
            !this.toggleSettingsBtn ||
            !this.pointsPanel ||
            !this.formPanel ||
            !this.settingsPanel) {
            console.error("PanelManager: One or more toggle buttons or panel elements are missing.");
            return;
        }
        this.panels = [
            { element: this.pointsPanel, name: "points" },
            { element: this.formPanel, name: "form" },
            { element: this.settingsPanel, name: "settings" },
        ];
        this.init();
    }
    init() {
        this.setInitialPanelState();
        this.addEventListeners();
    }
    hideAllPanels() {
        this.panels.forEach((p) => p.element.classList.add("hidden"));
    }
    handleToggle(panelElement, panelName) {
        const isHidden = panelElement.classList.contains("hidden");
        this.hideAllPanels();
        if (isHidden) {
            panelElement.classList.remove("hidden");
            window.history.pushState({}, "", `?panel=${panelName}`);
        }
        else {
            window.history.pushState({}, "", window.location.pathname);
        }
    }
    setInitialPanelState() {
        var _a;
        const params = new URLSearchParams(window.location.search);
        const panelToShowName = params.get("panel");
        this.hideAllPanels();
        const panelToActivate = this.panels.find((p) => p.name === panelToShowName);
        if (panelToActivate) {
            panelToActivate.element.classList.remove("hidden");
        }
        else {
            // Default to points panel if no specific panel or invalid panel in URL
            (_a = this.pointsPanel) === null || _a === void 0 ? void 0 : _a.classList.remove("hidden");
        }
    }
    addEventListeners() {
        var _a, _b, _c;
        (_a = this.togglePointsBtn) === null || _a === void 0 ? void 0 : _a.addEventListener("click", () => {
            if (this.pointsPanel)
                this.handleToggle(this.pointsPanel, "points");
        });
        (_b = this.toggleFormBtn) === null || _b === void 0 ? void 0 : _b.addEventListener("click", () => {
            if (this.formPanel)
                this.handleToggle(this.formPanel, "form");
        });
        (_c = this.toggleSettingsBtn) === null || _c === void 0 ? void 0 : _c.addEventListener("click", () => {
            if (this.settingsPanel)
                this.handleToggle(this.settingsPanel, "settings");
        });
        // Optional: Listen to popstate to handle browser back/forward navigation
        window.addEventListener("popstate", () => this.setInitialPanelState());
    }
}
window.addEventListener("DOMContentLoaded", () => {
    new PanelManager();
});
//# sourceMappingURL=view_route_panels.js.map