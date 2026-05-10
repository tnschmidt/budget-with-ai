export class SpeechCapture {
  constructor({ onResult, onError }) {
    this._onResult = onResult;
    this._onError = onError;
    this._recognition = null;
    this._listening = false;
    this._supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  get supported() { return this._supported; }
  get listening() { return this._listening; }

  start() {
    if (!this._supported || this._listening) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this._recognition = new SR();
    this._recognition.continuous = false;
    this._recognition.interimResults = true;
    this._recognition.lang = navigator.language;

    this._recognition.onstart = () => {
      this._listening = true;
      this._onStateChange?.('listening');
    };

    this._recognition.onresult = (e) => {
      let interim = '';
      let final = '';
      for (const result of e.results) {
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      this._onTranscript?.(final || interim, !!final);
    };

    this._recognition.onend = () => {
      this._listening = false;
      this._onStateChange?.('idle');
    };

    this._recognition.onerror = (e) => {
      this._listening = false;
      this._onStateChange?.('idle');
      if (e.error !== 'no-speech') {
        this._onError?.(e.error);
      }
    };

    this._recognition.start();
  }

  stop() {
    this._recognition?.stop();
  }

  onStateChange(fn)  { this._onStateChange = fn; }
  onTranscript(fn)   { this._onTranscript = fn; }
}
