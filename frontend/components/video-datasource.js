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
        this.addEventListener("video-selected", (event) => {
            this.player.setVideo(event.detail.video);
        });
        this.addEventListener("video-retry", () => this.loadVideos());
        this.loadVideos();
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
