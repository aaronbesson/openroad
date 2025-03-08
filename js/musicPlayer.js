class MusicPlayer {
    constructor() {
        this.audio = new Audio();
        this.isPlaying = false;
        this.currentSource = 'soundtrack';
        this.volume = 0.7;
        
        // Radio stream URLs (example streams - replace with actual ones)
        this.streams = {
            'soundtrack': '/soundfx/bk.mp3',
            'scorch-radio': 'http://s3.radio.co/sd03f5dd0c/listen.m3u'
        };

        this.initializeControls();
    }

    initializeControls() {
        this.playPauseBtn = document.getElementById('play-pause');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeIcon = document.getElementById('volume-icon');
        this.audioSource = document.getElementById('audio-source');

        // Event listeners
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        this.volumeIcon.addEventListener('click', () => this.toggleMute());
        this.audioSource.addEventListener('change', (e) => this.changeSource(e.target.value));

        // Initialize audio source
        this.audio.src = this.streams[this.currentSource];
        this.audio.volume = this.volume;
    }

    // New method to start playing the main soundtrack
    startMainSoundtrack() {
        this.currentSource = 'soundtrack';
        this.audio.src = this.streams[this.currentSource];
        this.audio.play().then(() => {
            this.isPlaying = true;
            this.playPauseBtn.textContent = '⏸️';
        }).catch(error => {
            console.error('Error playing soundtrack:', error);
        });
    }

    togglePlay() {
        if (this.isPlaying) {
            this.audio.pause();
            this.playPauseBtn.textContent = '▶️';
        } else {
            this.audio.play();
            this.playPauseBtn.textContent = '⏸️';
        }
        this.isPlaying = !this.isPlaying;
    }

    setVolume(value) {
        this.volume = value;
        this.audio.volume = value;
        this.updateVolumeIcon();
    }

    toggleMute() {
        if (this.audio.volume > 0) {
            this.lastVolume = this.audio.volume;
            this.setVolume(0);
            this.volumeSlider.value = 0;
        } else {
            this.setVolume(this.lastVolume || 0.7);
            this.volumeSlider.value = this.lastVolume * 100 || 70;
        }
    }

    updateVolumeIcon() {
        if (this.audio.volume === 0) {
            this.volumeIcon.textContent = '🔇';
        } else if (this.audio.volume < 0.5) {
            this.volumeIcon.textContent = '🔉';
        } else {
            this.volumeIcon.textContent = '🔊';
        }
    }

    changeSource(source) {
        const wasPlaying = this.isPlaying;
        this.audio.pause();
        this.currentSource = source;
        this.audio.src = this.streams[source];
        if (wasPlaying) {
            this.audio.play();
        }
    }
}

// Export the class
export default MusicPlayer; 