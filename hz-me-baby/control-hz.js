document.querySelector("button.start").addEventListener("click", function () {
  audioCtx.resume().then(() => {
    console.log("Playback resumed successfully");
  });
});

var audioCtx = new (window.AudioContext || window.webkitAudioContext)(),
  oscillatorNode = audioCtx.createOscillator(),
  gainNode = audioCtx.createGain();

var options = {
  mute: true,
  frequency: 500,
  direction: "",
  volume: 0.8,
  speed: 1,
  grossTune: 5,
  mediumTune: 0.5,
  fineTune: 0.05,
};

var keys = [
  {
    key: "q",
    direction: "down",
    tune: options.grossTune,
  },
  {
    key: "w",
    direction: "up",
    tune: options.grossTune,
  },
  {
    key: "e",
    direction: "down",
    tune: options.mediumTune,
  },
  {
    key: "r",
    direction: "up",
    tune: options.mediumTune,
  },
  {
    key: "t",
    direction: "down",
    tune: options.fineTune,
  },
  {
    key: "y",
    direction: "up",
    tune: options.fineTune,
  },
];

var frequencyElement = document.getElementById("frequency");

oscillatorNode.connect(gainNode);
gainNode.connect(audioCtx.destination);
oscillatorNode.start();
oscillatorNode.frequency.value = options.frequency;
gainNode.gain.value = 0;

function setDirectionFrequency() {
  if (options.direction === "up") {
    options.frequency += options.speed;
  }
  if (options.direction === "down") {
    options.frequency -= options.speed;
  }
  oscillatorNode.frequency.value = options.frequency;
  frequencyElement.innerHTML = options.frequency.toFixed(2);
}

function setNotes(event) {
  if (event.key === "") {
    if (options.mute) {
      gainNode.gain.value = options.volume;
      options.mute = false;
    } else {
      gainNode.gain.value = 0;
      options.mute = true;
    }
  }
  for (var i = keys.length - 1; i >= 0; i--) {
    if (event.key === keys[i].key) {
      options.direction = keys[i].direction;
      options.speed = keys[i].tune;
    }
  }
}

function resetDirection() {
  options.direction = "";
}

function keyDown(event) {
  if (event.target.localName === "button") {
    setNotes({ key: event.target.value });
  }
}

setInterval(setDirectionFrequency, 40);

var element = document.querySelector("#controls");

element.addEventListener("touchstart", keyDown);
element.addEventListener("touchend", resetDirection);
element.addEventListener("mousedown", keyDown);
element.addEventListener("mouseup", resetDirection);

document.addEventListener("keydown", setNotes);
document.addEventListener("keyup", resetDirection);
