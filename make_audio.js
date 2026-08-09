const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const duration = 3.5; // seconds
const numSamples = Math.floor(sampleRate * duration);
const numChannels = 2;

const leftBuffer = new Float32Array(numSamples);
const rightBuffer = new Float32Array(numSamples);

// --- SYNTHESIS PARAMETERS ---
// Submarine Ping: Sonar pulse at ~440Hz -> 380Hz
// Dark Braam: Sub bass 55Hz (A1) + 110Hz (A2) + 82.41Hz (E2)

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;

  // 1. SUBMARINE PING (Sonar pulse)
  let ping = 0;
  if (t < 3.0) {
    const pingFreq = 440 * Math.exp(-t * 0.15); // gentle pitch drift
    const pingEnv = Math.exp(-t * 1.8) * Math.sin(Math.PI * Math.min(t / 0.01, 1)); // 10ms attack, exponential decay
    // Sine + subtle harmonics
    ping = (Math.sin(2 * Math.PI * pingFreq * t) + 0.3 * Math.sin(4 * Math.PI * pingFreq * t)) * pingEnv;
  }

  // 2. DARK BRAAM LOW-PASS (Deep cinematic sub-bass braam)
  let braam = 0;
  if (t < 3.2) {
    const braamEnv = (1 - Math.exp(-t * 20)) * Math.exp(-t * 0.85); // 50ms attack, 3s sustain/decay
    const f0 = 55.0; // A1
    const f1 = 82.41; // E2 (fifth)
    
    // Rich brassy saw/triangle harmonics
    let braamOsc = 0.5 * Math.sin(2 * Math.PI * f0 * t)
                 + 0.3 * Math.sin(2 * Math.PI * f1 * t)
                 + 0.25 * (Math.abs((t * f0) % 1 - 0.5) * 4 - 1) // Triangle
                 + 0.15 * Math.sin(2 * Math.PI * f0 * 2 * t);

    // Sub-bass warmth
    braamOsc += 0.4 * Math.sin(2 * Math.PI * (f0 / 2) * t);
    
    braam = braamOsc * braamEnv * 0.8;
  }

  // Mix Ping + Braam
  leftBuffer[i] = ping * 0.4 + braam * 0.6;
  rightBuffer[i] = ping * 0.35 + braam * 0.65; // Slight stereo offset
}

// --- HIGH CUT FREQUENCY FILTER (Low-pass at 2800 Hz) ---
function applyLowPass(buffer, cutoff, fs) {
  const w0 = 2 * Math.PI * cutoff / fs;
  const alpha = Math.sin(w0) / (2 * 0.707); // Q = 0.707
  const b0 = (1 - Math.cos(w0)) / 2;
  const b1 = 1 - Math.cos(w0);
  const b2 = (1 - Math.cos(w0)) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buffer.length; i++) {
    const x0 = buffer[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
    buffer[i] = y0;
  }
}

applyLowPass(leftBuffer, 2800, sampleRate);
applyLowPass(rightBuffer, 2800, sampleRate);

// --- LOW-FREQUENCY DELAY & REVERB ---
const delayTime1 = Math.floor(sampleRate * 0.38); // 380ms delay
const delayTime2 = Math.floor(sampleRate * 0.54); // 540ms delay

const outLeft = new Float32Array(numSamples);
const outRight = new Float32Array(numSamples);

for (let i = 0; i < numSamples; i++) {
  let l = leftBuffer[i];
  let r = rightBuffer[i];

  // Low frequency delay echoes
  if (i >= delayTime1) {
    l += outLeft[i - delayTime1] * 0.42;
    r += outRight[i - delayTime1] * 0.38;
  }
  if (i >= delayTime2) {
    l += outLeft[i - delayTime2] * 0.28;
    r += outRight[i - delayTime2] * 0.32;
  }

  outLeft[i] = l;
  outRight[i] = r;
}

// Reverb Tail & Master Envelope (3.5s max duration, 2.5s-3s sustain)
let maxAmp = 0;
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  // Master fade out at the very end (3.0s -> 3.5s)
  let masterEnv = 1.0;
  if (t > 3.0) {
    masterEnv = (3.5 - t) / 0.5;
  }
  outLeft[i] *= masterEnv;
  outRight[i] *= masterEnv;

  maxAmp = Math.max(maxAmp, Math.abs(outLeft[i]), Math.abs(outRight[i]));
}

// Normalize audio peak to 0.92 (-0.7dB)
const normScale = maxAmp > 0 ? (0.92 / maxAmp) : 1;

// --- BUILD WAV FILE BINARY ---
const bytesPerSample = 2; // 16-bit
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = numSamples * blockAlign;
const headerSize = 44;
const totalSize = headerSize + dataSize;

const wavBuffer = Buffer.alloc(totalSize);

// RIFF header
wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(totalSize - 8, 4);
wavBuffer.write('WAVE', 8);

// fmt chunk
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16); // Chunk size
wavBuffer.writeUInt16LE(1, 20);  // Audio format (1 = PCM)
wavBuffer.writeUInt16LE(numChannels, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(byteRate, 28);
wavBuffer.writeUInt16LE(blockAlign, 32);
wavBuffer.writeUInt16LE(bytesPerSample * 8, 34);

// data chunk
wavBuffer.write('data', 36);
wavBuffer.writeUInt32LE(dataSize, 40);

// Write PCM 16-bit audio samples
let offset = 44;
for (let i = 0; i < numSamples; i++) {
  const sL = Math.max(-1, Math.min(1, outLeft[i] * normScale));
  const sR = Math.max(-1, Math.min(1, outRight[i] * normScale));

  const sampleIntL = Math.floor(sL < 0 ? sL * 32768 : sL * 32767);
  const sampleIntR = Math.floor(sR < 0 ? sR * 32768 : sR * 32767);

  wavBuffer.writeInt16LE(sampleIntL, offset);
  wavBuffer.writeInt16LE(sampleIntR, offset + 2);
  offset += 4;
}

const outputPath = path.join(__dirname, 'intro_cinematic.wav');
fs.writeFileSync(outputPath, wavBuffer);
console.log(`Successfully generated ${outputPath} (${numSamples} samples, ${(dataSize / 1024).toFixed(1)} KB)`);
