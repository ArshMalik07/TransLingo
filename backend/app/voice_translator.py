import sounddevice as sd
from scipy.io.wavfile import write
import whisper
from googletrans import Translator
from gtts import gTTS
import os

# 1️⃣ Step: Record voice
def record_voice(filename="input.wav", duration=5, fs=16000):
    print("🎙️ Speak now...")
    audio = sd.rec(int(duration * fs), samplerate=fs, channels=1)
    sd.wait()
    write(filename, fs, audio)
    print("✅ Voice saved:", filename)

# 2️⃣ Step: Speech-to-Text using Whisper
def speech_to_text(filename="input.wav", language_code='hi'):
    model = whisper.load_model("base")
    result = model.transcribe(filename, language=language_code)
    print("📝 You said:", result["text"])
    return result["text"]

# 3️⃣ Step: Translate text
def translate_text(text, src_lang='hi', target_lang='en'):
    translator = Translator()
    translated = translator.translate(text, src=src_lang, dest=target_lang)
    print(f"🌐 Translated ({src_lang} → {target_lang}):", translated.text)
    return translated.text

# 4️⃣ Step: Text-to-Speech using gTTS
def speak_text(text, lang='en', filename="output.mp3"):
    tts = gTTS(text=text, lang=lang)
    tts.save(filename)
    print("🔊 Playing translation...")
    # os.system("start " + filename if os.name == "nt" else "afplay " + filename)

# 🧩 Main Execution
if __name__ == "__main__":
    # Set your source and target languages here
    SOURCE_LANG = 'hi'       # Tu jis language me bolega
    TARGET_LANG = 'en'       # Samne wale ko jis language me sunani hai

    record_voice("input.wav", duration=5)
    spoken_text = speech_to_text("input.wav", language_code=SOURCE_LANG)
    translated_text = translate_text(spoken_text, src_lang=SOURCE_LANG, target_lang=TARGET_LANG)
    speak_text(translated_text, lang=TARGET_LANG)
