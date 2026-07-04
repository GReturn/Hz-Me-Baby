// Global Audio Variables
let audioCtx = null;
let oscillatorNode = null;
let filterNode = null;
let gainNode = null;
let analyserNode = null;
let lfoNode = null;
let lfoGain = null;
let isPlaying = false;
let animationFrameId = null;

// Options & Keyboard Configuration
const options = {
  frequency: 500,
  direction: "",
  volume: 0.8,
  speed: 1,
  grossTune: 5,
  mediumTune: 0.5,
  fineTune: 0.05,
  waveform: "sine",
  
  // Advanced Features State
  filterEnabled: false,
  filterCutoff: 20000,
  filterQ: 1.0,
  lfoEnabled: false,
  lfoTarget: "pitch", // "pitch" or "volume"
  lfoRate: 5.0,
  lfoDepth: 50
};

const keys = [
  { key: "q", direction: "down", tune: options.grossTune, elementId: "key-q" },
  { key: "w", direction: "up", tune: options.grossTune, elementId: "key-w" },
  { key: "e", direction: "down", tune: options.mediumTune, elementId: "key-e" },
  { key: "r", direction: "up", tune: options.mediumTune, elementId: "key-r" },
  { key: "t", direction: "down", tune: options.fineTune, elementId: "key-t" },
  { key: "y", direction: "up", tune: options.fineTune, elementId: "key-y" }
];

// DOM Elements
const frequencyDisplay = document.getElementById("frequency-display");
const frequencyInput = document.getElementById("frequency-input");
const statusBadge = document.getElementById("status-badge");
const waveformBadge = document.getElementById("waveform-badge");
const playBtn = document.getElementById("master-play");
const playText = document.getElementById("play-text");
const playIcon = playBtn.querySelector(".play-icon");
const pauseIcon = playBtn.querySelector(".pause-icon");
const volumeSlider = document.getElementById("volume-slider");
const canvas = document.getElementById("oscilloscope");
const canvasCtx = canvas.getContext("2d");

// Advanced Accordion DOM Elements
const advancedToggle = document.getElementById("advanced-toggle");
const advancedPanel = document.getElementById("advanced-panel");

const filterEnableCheck = document.getElementById("filter-enable");
const filterCutoffSlider = document.getElementById("filter-cutoff");
const filterCutoffVal = document.getElementById("cutoff-val");
const filterQSlider = document.getElementById("filter-q");
const filterQVal = document.getElementById("q-val");

const lfoEnableCheck = document.getElementById("lfo-enable");
const lfoTargetPitch = document.getElementById("lfo-target-pitch");
const lfoTargetVolume = document.getElementById("lfo-target-volume");
const lfoRateSlider = document.getElementById("lfo-rate");
const lfoRateVal = document.getElementById("lfo-rate-val");
const lfoDepthSlider = document.getElementById("lfo-depth");
const lfoDepthVal = document.getElementById("lfo-depth-val");

// Accordion Toggle
advancedToggle.addEventListener("click", () => {
  advancedToggle.classList.toggle("active");
  advancedPanel.classList.toggle("open");
});

// Set canvas dimensions
function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Audio Graph Initialization
function initAudio() {
  if (audioCtx) return;
  
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  oscillatorNode = audioCtx.createOscillator();
  filterNode = audioCtx.createBiquadFilter();
  gainNode = audioCtx.createGain();
  analyserNode = audioCtx.createAnalyser();
  
  analyserNode.fftSize = 1024;
  
  // Set up primary chain: Osc -> Filter -> Master Gain -> Analyser -> Output
  oscillatorNode.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
  
  oscillatorNode.type = options.waveform;
  oscillatorNode.frequency.setValueAtTime(options.frequency, audioCtx.currentTime);
  
  // Configure Filter
  filterNode.type = "lowpass";
  updateFilterSettings();
  
  // Set up LFO Modulator nodes
  lfoNode = audioCtx.createOscillator();
  lfoGain = audioCtx.createGain();
  
  lfoNode.frequency.setValueAtTime(options.lfoRate, audioCtx.currentTime);
  lfoNode.connect(lfoGain);
  lfoNode.start();
  
  updateLFO();
  
  // Start with 0 volume
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  oscillatorNode.start();
  
  startVisualizer();
}

// Lowpass Filter Updates
function updateFilterSettings() {
  if (!filterNode) return;
  
  if (options.filterEnabled) {
    // Logarithmic curve lookup or direct value
    filterNode.frequency.setTargetAtTime(options.filterCutoff, audioCtx.currentTime, 0.015);
    filterNode.Q.setTargetAtTime(options.filterQ, audioCtx.currentTime, 0.015);
  } else {
    // Open filter fully
    filterNode.frequency.setTargetAtTime(20000, audioCtx.currentTime, 0.015);
    filterNode.Q.setTargetAtTime(1.0, audioCtx.currentTime, 0.015);
  }
}

// LFO Modulator routing & depth automation
function updateLFO() {
  if (!lfoNode || !lfoGain) return;
  
  // Set LFO rate
  lfoNode.frequency.setTargetAtTime(options.lfoRate, audioCtx.currentTime, 0.02);
  
  // Clean disconnect
  try {
    lfoGain.disconnect();
  } catch (e) {}
  
  if (options.lfoEnabled && isPlaying) {
    if (options.lfoTarget === "pitch") {
      lfoGain.connect(oscillatorNode.frequency);
      // Map depth percentage (0-100) to pitch offset (0-150 Hz)
      lfoGain.gain.setTargetAtTime((options.lfoDepth / 100) * 150, audioCtx.currentTime, 0.02);
    } else if (options.lfoTarget === "volume") {
      lfoGain.connect(gainNode.gain);
      // Map depth percentage (0-100) to master volume scale offset
      lfoGain.gain.setTargetAtTime((options.lfoDepth / 100) * options.volume, audioCtx.currentTime, 0.02);
    }
  } else {
    // Disable LFO impact by setting its gain to 0
    lfoGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
  }
}

// Master Toggle Playback
function toggleSynth() {
  if (!audioCtx) {
    initAudio();
  }
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  if (!isPlaying) {
    // Play: set volume with linear ramp to avoid click pop
    gainNode.gain.setTargetAtTime(options.volume, audioCtx.currentTime, 0.015);
    isPlaying = true;
    statusBadge.textContent = "PLAYING";
    statusBadge.classList.add("playing");
    playText.textContent = "Stop Synth";
    playBtn.classList.add("playing");
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    updateLFO(); // recalculate routing
  } else {
    // Stop: ramp volume to 0
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.015);
    isPlaying = false;
    statusBadge.textContent = "PAUSED";
    statusBadge.classList.remove("playing");
    playText.textContent = "Start Synth";
    playBtn.classList.remove("playing");
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    updateLFO(); // Reset LFO connections and set gain to 0
  }
}

playBtn.addEventListener("click", toggleSynth);

// Volume update handler
volumeSlider.addEventListener("input", (e) => {
  options.volume = parseFloat(e.target.value);
  if (isPlaying && gainNode) {
    gainNode.gain.setTargetAtTime(options.volume, audioCtx.currentTime, 0.01);
  }
  // Re-scale LFO volume depth mapping dynamically
  if (options.lfoEnabled && options.lfoTarget === "volume") {
    updateLFO();
  }
});

// Waveform Shape Selection
const waveButtons = document.querySelectorAll(".wave-btn");
waveButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    waveButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    options.waveform = btn.dataset.wave;
    waveformBadge.textContent = options.waveform.toUpperCase();
    
    if (oscillatorNode) {
      oscillatorNode.type = options.waveform;
    }
  });
});

// Presets
const presetButtons = document.querySelectorAll(".preset-btn");
presetButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const targetHz = parseFloat(btn.dataset.hz);
    setFrequency(targetHz);
  });
});

// Frequency Mutator
function setFrequency(value) {
  const clamped = Math.max(20, Math.min(20000, value));
  options.frequency = clamped;
  
  if (oscillatorNode) {
    oscillatorNode.frequency.setTargetAtTime(clamped, audioCtx.currentTime, 0.02);
  }
  
  frequencyDisplay.textContent = clamped.toFixed(2);
  frequencyInput.value = clamped.toFixed(2);
}

// Live Tuning Sweep Loop
function sweepFrequency() {
  if (options.direction === "up") {
    setFrequency(options.frequency + options.speed);
  } else if (options.direction === "down") {
    setFrequency(options.frequency - options.speed);
  }
}
setInterval(sweepFrequency, 40);

// Key Caps Event Handling & Active class highlights
function startTune(keyConfig) {
  options.direction = keyConfig.direction;
  options.speed = keyConfig.tune;
  
  const el = document.getElementById(keyConfig.elementId);
  if (el) el.classList.add("active");
}

function stopTune() {
  options.direction = "";
  keys.forEach(k => {
    const el = document.getElementById(k.elementId);
    if (el) el.classList.remove("active");
  });
}

// Keyboard Listeners
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (document.activeElement === frequencyInput) return;
  
  // Spacebar play/pause
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    toggleSynth();
    return;
  }
  
  const match = keys.find(k => k.key === e.key.toLowerCase());
  if (match) {
    e.preventDefault();
    startTune(match);
  }
});

document.addEventListener("keyup", (e) => {
  if (document.activeElement === frequencyInput) return;
  
  const match = keys.find(k => k.key === e.key.toLowerCase());
  if (match) {
    stopTune();
  }
});

// Mouse/Touch controls on On-screen Keyboard Elements
keys.forEach(k => {
  const btn = document.getElementById(k.elementId);
  if (btn) {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startTune(k);
    });
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      startTune(k);
    });
  }
});

window.addEventListener("mouseup", stopTune);
window.addEventListener("touchend", stopTune);

// Direct Numeric Frequency Editing
frequencyDisplay.parentElement.addEventListener("click", () => {
  frequencyDisplay.style.display = "none";
  frequencyInput.style.display = "inline-block";
  frequencyInput.value = options.frequency.toFixed(2);
  frequencyInput.focus();
  frequencyInput.select();
});

function handleDirectInputSubmit() {
  const val = parseFloat(frequencyInput.value);
  if (!isNaN(val)) {
    setFrequency(val);
  }
  frequencyInput.style.display = "none";
  frequencyDisplay.style.display = "inline-block";
}

frequencyInput.addEventListener("blur", handleDirectInputSubmit);
frequencyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    frequencyInput.blur();
  } else if (e.key === "Escape") {
    frequencyInput.value = options.frequency.toFixed(2);
    frequencyInput.blur();
  }
});

// Advanced Filter Controls Events
filterEnableCheck.addEventListener("change", (e) => {
  options.filterEnabled = e.target.checked;
  if (!audioCtx) initAudio();
  updateFilterSettings();
});

filterCutoffSlider.addEventListener("input", (e) => {
  options.filterCutoff = parseFloat(e.target.value);
  filterCutoffVal.textContent = options.filterCutoff;
  updateFilterSettings();
});

filterQSlider.addEventListener("input", (e) => {
  options.filterQ = parseFloat(e.target.value);
  filterQVal.textContent = options.filterQ.toFixed(1);
  updateFilterSettings();
});

// Advanced LFO Controls Events
lfoEnableCheck.addEventListener("change", (e) => {
  options.lfoEnabled = e.target.checked;
  if (!audioCtx) initAudio();
  updateLFO();
});

lfoTargetPitch.addEventListener("click", () => {
  lfoTargetVolume.classList.remove("active");
  lfoTargetPitch.classList.add("active");
  options.lfoTarget = "pitch";
  updateLFO();
});

lfoTargetVolume.addEventListener("click", () => {
  lfoTargetPitch.classList.remove("active");
  lfoTargetVolume.classList.add("active");
  options.lfoTarget = "volume";
  updateLFO();
});

lfoRateSlider.addEventListener("input", (e) => {
  options.lfoRate = parseFloat(e.target.value);
  lfoRateVal.textContent = options.lfoRate.toFixed(1);
  updateLFO();
});

lfoDepthSlider.addEventListener("input", (e) => {
  options.lfoDepth = parseInt(e.target.value);
  lfoDepthVal.textContent = options.lfoDepth;
  updateLFO();
});

// Waveform Oscilloscope Drawing Loop
function startVisualizer() {
  if (!analyserNode) return;
  
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function draw() {
    animationFrameId = requestAnimationFrame(draw);
    analyserNode.getByteTimeDomainData(dataArray);
    
    // Clear canvas
    canvasCtx.fillStyle = "rgba(6, 6, 10, 0.35)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set line style
    canvasCtx.lineWidth = 3;
    
    if (isPlaying) {
      canvasCtx.strokeStyle = "#00f2fe";
      canvasCtx.shadowBlur = 10;
      canvasCtx.shadowColor = "#00f2fe";
    } else {
      canvasCtx.strokeStyle = "rgba(0, 242, 254, 0.25)";
      canvasCtx.shadowBlur = 0;
    }
    
    canvasCtx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      
      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
    canvasCtx.shadowBlur = 0;
  }
  
  draw();
}


