import "./video-player.js";
import "./video-catalogue.js";

class VideoDatasource extends HTMLElement {
    connectedCallback() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.catalogue = this.querySelector("video-catalogue");
        this.player = this.querySelector("video-player");
        this.themeToggle = this.querySelector(".theme-toggle");
        this.initializeTheme();
        this.themeToggle.addEventListener("click", () => this.toggleTheme());
        this.addEventListener("video-selected", (event) => {
            this.player.setVideo(event.detail.video);
        });
        this.addEventListener("video-retry", () => this.loadVideos());
        this.loadVideos();
    }

    initializeTheme() {
        let theme = "dark";
        try {
            const savedTheme = localStorage.getItem("robin-theme");
            if (savedTheme === "light" || savedTheme === "dark") {
                theme = savedTheme;
            }
        } catch (error) {
            console.warn("Unable to load the saved theme preference:", error);
        }
        this.applyTheme(theme);
    }

    toggleTheme() {
        const theme = document.body.dataset.theme === "dark" ? "light" : "dark";
        this.applyTheme(theme);
        try {
            localStorage.setItem("robin-theme", theme);
        } catch (error) {
            console.warn("Unable to save the theme preference:", error);
        }
    }

    applyTheme(theme) {
        document.body.dataset.theme = theme;
        document.body.dataset.agThemeMode = theme;
        const isDark = theme === "dark";
        this.themeToggle.querySelector(".theme-icon").textContent = isDark ? "☼" : "☾";
        this.themeToggle.querySelector(".theme-label").textContent = isDark ? "Light mode" : "Dark mode";
        this.themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
        document.querySelector('meta[name="theme-color"]').content = isDark ? "#14211b" : "#f4f7f1";
    }

    async loadVideos() {
        try {
            const response = await fetch("/api/videos");
            if (!response.ok) {
                throw new Error(`Video request failed with status ${response.status}.`);
            }
            const videos = await response.json();
            if (!Array.isArray(videos)) {
                throw new Error("The video library returned an invalid response.");
            }
            this.catalogue.setVideos(videos);
        } catch (error) {
            console.error("Unable to load the video library:", error);
            this.catalogue.setError();
        }
    }
}

customElements.define("video-datasource", VideoDatasource);
