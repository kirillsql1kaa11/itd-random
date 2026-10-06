class SoundFX {
    constructor() {
        this.ctx = null;
        this.muted = true;
    }

    init() {}

    toggleMute() {
        return true;
    }

    isMuted() {
        return true;
    }

    playClick() {}

    playCorrect() {}

    playWrong() {}

    playStreak() {}

    playWin() {}
}

window.soundFX = new SoundFX();
