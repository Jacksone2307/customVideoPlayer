# Custom Video Player

A small, self-hosted video library built with browser Web Components and Node.js. The catalogue metadata is stored in SQLite; the video files stay on disk.

## Run it

1. Install Node.js 22.13 or later.
2. Run `npm start` from the project directory.
3. Open <http://localhost:8000>.
4. Put video files in `backend/videos` and restart the server to index them.

Supported formats: MP4, M4V, MOV, OGV, OGG, and WebM. The title is generated from each filename. The server creates the SQLite database on first start.

The current version is for browsing and playing files already placed in the video folder. It does not include an upload interface. The server listens on this computer only; add authentication and access controls before exposing it to a network.

## Components

- `<video-player>` in `frontend/components/video-player.js` provides native browser playback controls.
- `<video-catalogue>` in `frontend/components/video-catalogue.js` displays the indexed videos and emits a selection event.
- `<video-datasource>` in `frontend/components/video-datasource.js` retrieves the catalogue from `/api/videos` and connects selection to the player.
- `frontend/components/helpers/format-file-size.js` exports the shared file-size formatter.

The Node server indexes video files into SQLite at startup and serves byte ranges so browser playback can seek.
