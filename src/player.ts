type Handlers = {
  onTime: (current: number, duration: number) => void;
  onEnd: () => void;
  onError: () => void;
  onPlayState: (playing: boolean) => void;
};

export class ReaderAudio {
  private audio = new Audio();
  private playing = false;
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
    this.audio.preload = "none";
    this.audio.setAttribute("playsinline", "true");
    this.audio.ontimeupdate = () => {
      this.handlers.onTime(this.audio.currentTime, Number.isFinite(this.audio.duration) ? this.audio.duration : 0);
    };
    this.audio.onended = () => {
      this.playing = false;
      this.handlers.onPlayState(false);
      this.handlers.onEnd();
    };
    this.audio.onerror = () => {
      if (!this.audio.getAttribute("src")) return;
      this.playing = false;
      this.handlers.onPlayState(false);
      this.handlers.onError();
    };
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  load(src: string): void {
    this.stop();
    this.audio.preload = "metadata";
    this.audio.src = src;
  }

  async toggle(): Promise<void> {
    if (!this.audio.src) {
      this.handlers.onError();
      return;
    }
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
      this.handlers.onPlayState(false);
      return;
    }
    try {
      await this.audio.play();
      this.playing = true;
      this.handlers.onPlayState(true);
    } catch {
      this.playing = false;
      this.handlers.onPlayState(false);
      this.handlers.onError();
    }
  }

  stop(): void {
    this.audio.pause();
    this.playing = false;
    if (this.audio.src) this.audio.currentTime = 0;
    this.handlers.onPlayState(false);
  }

  seekRatio(ratio: number): void {
    const duration = this.audio.duration;
    if (!duration || !Number.isFinite(duration)) return;
    this.audio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
  }
}
