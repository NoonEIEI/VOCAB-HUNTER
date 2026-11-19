// Speech Engine: Native Text-to-Speech & Speech Recognition with Word-Level Scoring
class SpeechEngine {
  constructor() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = Boolean(SpeechRec);
    this.recognition = SpeechRec ? new SpeechRec() : null;
    this.isListening = false;

    if (this.recognition) {
      this.recognition.lang = "en-US";
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;
    }
  }

  speak(text, rate = 0.92) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = rate;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  normalize(str) {
    return str
      .toLowerCase()
      .replace(/i'll/g, "i will")
      .replace(/i'd/g, "i would")
      .replace(/i'm/g, "i am")
      .replace(/let's/g, "let us")
      .replace(/can't/g, "cannot")
      .replace(/don't/g, "do not")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  levenshtein(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  evaluatePronunciation(targetText, spokenText) {
    const normTarget = this.normalize(targetText);
    const normSpoken = this.normalize(spokenText);

    const targetWords = normTarget.split(" ").filter(Boolean);
    const spokenWords = normSpoken.split(" ").filter(Boolean);

    const wordResults = targetWords.map((tWord) => {
      const matched = spokenWords.some((sWord) => {
        if (sWord === tWord) return true;
        const dist = this.levenshtein(tWord, sWord);
        return tWord.length >= 4 && dist <= 1;
      });
      return { word: tWord, matched };
    });

    const maxLen = Math.max(normTarget.length, normSpoken.length) || 1;
    const charScore = Math.max(0, 1 - this.levenshtein(normTarget, normSpoken) / maxLen);
    const matchedCount = wordResults.filter((w) => w.matched).length;
    const wordScore = targetWords.length > 0 ? matchedCount / targetWords.length : 0;

    const finalScore = Math.round((charScore * 0.45 + wordScore * 0.55) * 100);
    const passed = finalScore >= 75 || (targetWords.length === 1 && matchedCount === 1);

    return {
      score: Math.min(100, finalScore),
      passed,
      wordResults,
      spokenText
    };
  }

  listen({ onInterim, onResult, onError, onEnd }) {
    if (!this.recognition) {
      onError?.("เบราว์เซอร์นี้ไม่รองรับไมค์อัตโนมัติ (แนะนำ Chrome / Safari) หรือใช้ช่องพิมพ์ด้านล่าง");
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      return;
    }

    this.isListening = true;

    this.recognition.onresult = (event) => {
      let interim = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) onInterim?.(interim);
      if (finalTranscript) onResult?.(finalTranscript);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      onError?.(`ไม่สามารถรับเสียงได้ (${event.error}) ลองกดไมค์อีกครั้งหรือใช้ช่องพิมพ์ด้านล่าง`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (err) {
      this.isListening = false;
      onError?.("กำลังเปิดไมโครโฟนอยู่ กรุณารอสักครู่แล้วลองใหม่");
    }
  }
}

window.SpeechEngine = SpeechEngine;
