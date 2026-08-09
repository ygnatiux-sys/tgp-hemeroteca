import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

function applyLowPass(buffer: Float32Array, cutoff: number, fs: number) {
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

function buildWavBuffer(outLeft: Float32Array, outRight: Float32Array, sampleRate: number): Buffer {
  const numSamples = outLeft.length;
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  let maxAmp = 0;
  for (let i = 0; i < numSamples; i++) {
    maxAmp = Math.max(maxAmp, Math.abs(outLeft[i]), Math.abs(outRight[i]));
  }
  const normScale = maxAmp > 0 ? (0.92 / maxAmp) : 1;

  const wavBuffer = Buffer.alloc(totalSize);

  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(totalSize - 8, 4);
  wavBuffer.write('WAVE', 8);

  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(numChannels, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(byteRate, 28);
  wavBuffer.writeUInt16LE(blockAlign, 32);
  wavBuffer.writeUInt16LE(bytesPerSample * 8, 34);

  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(dataSize, 40);

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
  return wavBuffer;
}

export const GET: APIRoute = async () => {
  try {
    const sampleRate = 44100;

    // ==========================================
    // 1. INTRO AUDIO SYNTHESIS (Submarine Ping + Braam, 3.5s)
    // ==========================================
    const introDuration = 3.5;
    const introSamples = Math.floor(sampleRate * introDuration);
    const introL = new Float32Array(introSamples);
    const introR = new Float32Array(introSamples);

    for (let i = 0; i < introSamples; i++) {
      const t = i / sampleRate;

      // Sonar ping
      let ping = 0;
      if (t < 3.0) {
        const pingFreq = 440 * Math.exp(-t * 0.15);
        const pingEnv = Math.exp(-t * 1.8) * Math.sin(Math.PI * Math.min(t / 0.01, 1));
        ping = (Math.sin(2 * Math.PI * pingFreq * t) + 0.3 * Math.sin(4 * Math.PI * pingFreq * t)) * pingEnv;
      }

      // Dark Braam Sub-bass
      let braam = 0;
      if (t < 3.2) {
        const braamEnv = (1 - Math.exp(-t * 20)) * Math.exp(-t * 0.85);
        const f0 = 55.0; // A1
        const f1 = 82.41; // E2
        let braamOsc = 0.5 * Math.sin(2 * Math.PI * f0 * t)
                     + 0.3 * Math.sin(2 * Math.PI * f1 * t)
                     + 0.25 * (Math.abs((t * f0) % 1 - 0.5) * 4 - 1)
                     + 0.15 * Math.sin(2 * Math.PI * f0 * 2 * t);
        braamOsc += 0.4 * Math.sin(2 * Math.PI * (f0 / 2) * t);
        braam = braamOsc * braamEnv * 0.8;
      }

      introL[i] = ping * 0.4 + braam * 0.6;
      introR[i] = ping * 0.35 + braam * 0.65;
    }

    applyLowPass(introL, 2800, sampleRate);
    applyLowPass(introR, 2800, sampleRate);

    // Intro Delay & Master Envelope
    const introOutL = new Float32Array(introSamples);
    const introOutR = new Float32Array(introSamples);
    const dTime1 = Math.floor(sampleRate * 0.38);
    const dTime2 = Math.floor(sampleRate * 0.54);

    for (let i = 0; i < introSamples; i++) {
      const t = i / sampleRate;
      let l = introL[i];
      let r = introR[i];

      if (i >= dTime1) { l += introOutL[i - dTime1] * 0.42; r += introOutR[i - dTime1] * 0.38; }
      if (i >= dTime2) { l += introOutL[i - dTime2] * 0.28; r += introOutR[i - dTime2] * 0.32; }

      let masterEnv = 1.0;
      if (t > 3.0) masterEnv = (3.5 - t) / 0.5;

      introOutL[i] = l * masterEnv;
      introOutR[i] = r * masterEnv;
    }

    const introWavBuffer = buildWavBuffer(introOutL, introOutR, sampleRate);

    // ==========================================
    // 2. OUTRO AUDIO SYNTHESIS ("Deep Sucker Punch" / "Tail Out", 5.5s)
    // Structure: 1.5s sustain + 4.0s decay tail
    // ==========================================
    const outroDuration = 5.5;
    const outroSamples = Math.floor(sampleRate * outroDuration);
    const outroL = new Float32Array(outroSamples);
    const outroR = new Float32Array(outroSamples);

    for (let i = 0; i < outroSamples; i++) {
      const t = i / sampleRate;

      // Deep Sub Drop: Exponential pitch sweep from 180Hz down to 28Hz
      const freq = 180 * Math.exp(-t * 2.2) + 28;
      
      // Impact Punch Attack (0ms - 150ms) + 1.5s Sustain + 4s Decay Tail
      let impactEnv = 0;
      if (t < 0.15) {
        impactEnv = Math.sin(Math.PI * (t / 0.15)); // Sharp transient punch
      }
      
      let sustainEnv = 0;
      if (t < 1.5) {
        sustainEnv = (1 - Math.exp(-t * 25)) * Math.exp(-t * 0.2); // 1.5s sustain
      } else {
        sustainEnv = Math.exp(-(t - 1.5) * 1.15); // 4.0s decay tail into silence
      }

      // Punch transient noise + Sub Sine/Saw
      const transientNoise = (Math.random() * 2 - 1) * Math.exp(-t * 40);
      const subDropOsc = Math.sin(2 * Math.PI * freq * t) 
                       + 0.4 * Math.sin(4 * Math.PI * freq * t)
                       + 0.25 * (Math.abs((t * freq) % 1 - 0.5) * 4 - 1);

      const sampleVal = (subDropOsc * sustainEnv + transientNoise * impactEnv * 1.5) * 0.9;

      outroL[i] = sampleVal;
      outroR[i] = sampleVal * 0.95; // Slight stereo width
    }

    applyLowPass(outroL, 2700, sampleRate);
    applyLowPass(outroR, 2700, sampleRate);

    // Deep Reverb Tail for Outro
    const outroOutL = new Float32Array(outroSamples);
    const outroOutR = new Float32Array(outroSamples);
    const outroDTime = Math.floor(sampleRate * 0.45);

    for (let i = 0; i < outroSamples; i++) {
      const t = i / sampleRate;
      let l = outroL[i];
      let r = outroR[i];

      if (i >= outroDTime) {
        l += outroOutL[i - outroDTime] * 0.48;
        r += outroOutR[i - outroDTime] * 0.45;
      }

      let masterEnv = 1.0;
      if (t > 5.0) masterEnv = (5.5 - t) / 0.5;

      outroOutL[i] = l * masterEnv;
      outroOutR[i] = r * masterEnv;
    }

    const outroWavBuffer = buildWavBuffer(outroOutL, outroOutR, sampleRate);

    // Save files to root and public directory
    const cwd = process.cwd();
    const publicDir = path.join(cwd, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    // Save intro files
    fs.writeFileSync(path.join(cwd, 'intro.cinematic.wav'), introWavBuffer);
    fs.writeFileSync(path.join(cwd, 'intro_cinematic.wav'), introWavBuffer);
    fs.writeFileSync(path.join(publicDir, 'intro.cinematic.wav'), introWavBuffer);
    fs.writeFileSync(path.join(publicDir, 'intro_cinematic.wav'), introWavBuffer);

    // Save outro files
    fs.writeFileSync(path.join(cwd, 'outro.cinematic.wav'), outroWavBuffer);
    fs.writeFileSync(path.join(cwd, 'outro_cinematic.wav'), outroWavBuffer);
    fs.writeFileSync(path.join(publicDir, 'outro.cinematic.wav'), outroWavBuffer);
    fs.writeFileSync(path.join(publicDir, 'outro_cinematic.wav'), outroWavBuffer);

    return new Response(JSON.stringify({
      success: true,
      introPath: path.join(publicDir, 'intro.cinematic.wav'),
      outroPath: path.join(publicDir, 'outro.cinematic.wav'),
      introBytes: introWavBuffer.length,
      outroBytes: outroWavBuffer.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
