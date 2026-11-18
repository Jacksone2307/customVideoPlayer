import { formatFileSize } from "./helpers/format-file-size.js";

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
                        <p>Make yourself at home.</p>
                        <span>Choose a video from your library to begin.</span>
                    </div>
                </div>
                <div class="now-playing">
                    <div>
                        <p class="eyebrow">NOW PLAYING</p>
                        <h2>Nothing selected</h2>
                    </div>
                    <div class="player-details">
                        <span class="video-file-size"></span>
                    </div>
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
        this.video.controls = true;
        this.video.hidden = false;
        this.placeholder.hidden = true;
        this.titleLabel.textContent = video.title;
        this.fileSize.textContent = formatFileSize(video.size);
    }
}

customElements.define("video-player", VideoPlayer);
