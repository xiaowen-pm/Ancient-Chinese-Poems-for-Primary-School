type Handlers = {
  onTime: (current: number, duration: number) => void;
  onEnd: () => void;
  onError: () => void;
  onPlayState: (playing: boolean) => void;
};

export class ReaderAudio {
  private audio = new Audio();
  private playing = false;
  private looping = false;
  /** Bumped whenever the source changes, so a late play() cannot start the new track. */
  private epoch = 0;
  /** Epoch of the latest requested play, or -1 when playback should stay stopped. */
  private desiredPlay = -1;
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
    this.audio.preload = "none";
    this.audio.setAttribute("playsinline", "true");
    this.audio.setAttribute("webkit-playsinline", "true");
    this.audio.controls = false;
    this.audio.style.display = "none";
    document.body.appendChild(this.audio);
    this.audio.ontimeupdate = () => {
      this.handlers.onTime(this.audio.currentTime, Number.isFinite(this.audio.duration) ? this.audio.duration : 0);
    };
    this.audio.onended = () => {
      if (this.looping) {
        // Some browsers still emit `ended` when `loop` is set. Restart this
        // element only; a newer load() bumps epoch and this play is ignored.
        try {
          this.audio.currentTime = 0;
        } catch {
          // The resource cannot seek yet. play() still restarts most files.
        }
        void this.startPlayback();
        return;
      }
      this.playing = false;
      this.handlers.onPlayState(false);
      this.handlers.onEnd();
    };
    this.audio.onerror = () => {
      if (!this.audio.getAttribute("src")) return;
      // Changing tracks aborts the previous fetch. That is not a broken file.
      if (this.audio.error?.code === 1) return;
      this.playing = false;
      this.handlers.onPlayState(false);
      this.handlers.onError();
    };
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Replay the current source from the start when it ends. Does not change tracks. */
  set loop(on: boolean) {
    this.looping = on;
    this.audio.loop = on;
  }

  load(src: string): void {
    this.epoch += 1;
    this.desiredPlay = -1;
    this.stop();
    this.audio.preload = "metadata";
    this.audio.src = src;
  }

  /** Start playback. Returns false when the browser blocks it, without treating that as a broken file. */
  async play(): Promise<boolean> {
    return this.startPlayback();
  }

  async toggle(): Promise<void> {
    if (!this.audio.src) {
      this.handlers.onError();
      return;
    }
    if (this.playing) {
      this.desiredPlay = -1;
      this.audio.pause();
      this.playing = false;
      this.handlers.onPlayState(false);
      return;
    }
    const started = await this.startPlayback();
    if (!started && this.desiredPlay === this.epoch) this.handlers.onError();
  }

  private async startPlayback(): Promise<boolean> {
    if (!this.audio.src) return false;
    const epoch = this.epoch;
    this.desiredPlay = epoch;
    try {
      await this.audio.play();
    } catch {
      if (this.epoch !== epoch || this.desiredPlay !== epoch) return false;
      this.playing = false;
      this.handlers.onPlayState(false);
      return false;
    }
    if (this.epoch !== epoch || this.desiredPlay !== epoch) {
      // A newer load asked for silence. Pause only if nothing newer requested play.
      if (this.desiredPlay !== this.epoch) this.audio.pause();
      return false;
    }
    this.playing = true;
    this.handlers.onPlayState(true);
    return true;
  }

  stop(): void {
    this.desiredPlay = -1;
    this.audio.pause();
    this.playing = false;
    if (this.audio.src && this.audio.readyState > 0) {
      try {
        this.audio.currentTime = 0;
      } catch {
        // Metadata is not in yet. The next load replaces the source.
      }
    }
    this.handlers.onPlayState(false);
  }

  seekRatio(ratio: number): void {
    const duration = this.audio.duration;
    if (!duration || !Number.isFinite(duration)) return;
    this.audio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
  }
}
