function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

class VideoPlayer extends HTMLElement {
    connectedCallback() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.innerHTML = `
            <section class="player-panel" aria-label="Video player">
                <div class="video-stage">
                    <video controls playsinline preload="metadata" hidden></video>
                    <div class="player-placeholder">
                        <span class="placeholder-icon" aria-hidden="true">▶</span>
                        <p>Your next favorite, right here.</p>
                        <span>Choose a video from your library to begin.</span>
                    </div>
                </div>
                <div class="now-playing">
                    <div>
                        <p class="eyebrow">NOW PLAYING</p>
                        <h2>Nothing selected</h2>
                    </div>
                    <span class="video-file-size"></span>
                </div>
            </section>
        `;

        this.video = this.querySelector("video");
        this.placeholder = this.querySelector(".player-placeholder");
        this.titleLabel = this.querySelector(".now-playing h2");
        this.fileSize = this.querySelector(".video-file-size");
        this.video.addEventListener("error", () => {
            this.fileSize.textContent = "This video could not be played.";
        });
    }

    setVideo(video) {
        this.video.src = video.url;
        this.video.hidden = false;
        this.placeholder.hidden = true;
        this.titleLabel.textContent = video.title;
        this.fileSize.textContent = formatFileSize(video.size);
    }
}

class VideoCatalogue extends HTMLElement {
    connectedCallback() {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
        this.innerHTML = `
            <section class="catalogue-panel" aria-labelledby="catalogue-title">
                <div class="catalogue-heading">
                    <div>
                        <p class="eyebrow">YOUR COLLECTION</p>
                        <h2 id="catalogue-title">Video library</h2>
                    </div>
                    <span class="video-count" aria-live="polite"></span>
                </div>
                <ul class="video-list"></ul>
                <div class="catalogue-message" role="status" hidden></div>
            </section>
        `;
        this.list = this.querySelector(".video-list");
        this.count = this.querySelector(".video-count");
        this.message = this.querySelector(".catalogue-message");
    }

    setVideos(videos) {
        this.list.replaceChildren();
        this.message.hidden = videos.length > 0;
        this.message.replaceChildren();
        this.count.textContent = `${videos.length} ${videos.length === 1 ? "video" : "videos"}`;

        if (videos.length === 0) {
            this.message.innerHTML = `
                <div class="empty-library-icon" aria-hidden="true">＋</div>
                <h3>Your library is waiting</h3>
                <p>Add video files to <code>backend/videos</code>, then restart the server.</p>
                <span>MP4, M4V, MOV, OGV, OGG, and WebM are supported.</span>
            `;
            this.message.hidden = false;
            return;
        }

        for (const [index, video] of videos.entries()) {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "video-card";
            button.setAttribute("aria-label", `Play ${video.title}`);

            const thumbnail = document.createElement("span");
            thumbnail.className = "video-thumbnail";
            thumbnail.setAttribute("aria-hidden", "true");
            thumbnail.innerHTML = '<span class="thumbnail-play">▶</span>';

            const details = document.createElement("span");
            details.className = "video-card-details";
            const title = document.createElement("span");
            title.className = "video-card-title";
            title.textContent = video.title;
            const metadata = document.createElement("span");
            metadata.className = "video-card-meta";
            metadata.textContent = `${String(index + 1).padStart(2, "0")}  ·  ${formatFileSize(video.size)}`;
            details.append(title, metadata);
            button.append(thumbnail, details);

            button.addEventListener("click", () => {
                this.list.querySelector(".video-card.is-selected")?.classList.remove("is-selected");
                button.classList.add("is-selected");
                this.dispatchEvent(new CustomEvent("video-selected", {
                    bubbles: true,
                    detail: { video }
                }));
            });
            item.append(button);
            this.list.append(item);
        }

        const firstCard = this.list.querySelector(".video-card");
        if (firstCard) {
            firstCard.classList.add("is-selected");
            this.dispatchEvent(new CustomEvent("video-selected", {
                bubbles: true,
                detail: { video: videos[0] }
            }));
        }
    }

    setError() {
        this.list.replaceChildren();
        this.count.textContent = "";
        this.message.replaceChildren();
        const heading = document.createElement("h3");
        heading.textContent = "Your library couldn't be loaded";
        const description = document.createElement("p");
        description.textContent = "Check that the video library server is running, then try again.";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "retry-button";
        retry.textContent = "Try again";
        retry.addEventListener("click", () => {
            this.dispatchEvent(new CustomEvent("video-retry", { bubbles: true }));
        });
        this.message.append(heading, description, retry);
        this.message.hidden = false;
    }
}

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

customElements.define("video-player", VideoPlayer);
customElements.define("video-catalogue", VideoCatalogue);
customElements.define("video-datasource", VideoDatasource);
